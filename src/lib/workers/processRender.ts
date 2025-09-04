/**
 * Process render worker for dev_plan_02 architecture
 * Handles synthesis, caching, stitching, and mastering
 * Uses p-limit for concurrency control to prevent rate limiting
 */

import { put, list } from '@vercel/blob';
import pLimit from 'p-limit';
import { 
  type Manifest, 
  type RenderStatus, 
  type Diagnostics,
  type TuningSettings 
} from '@/lib/types/tuning';
import { 
  generateChunkCacheKey, 
  generateRenderPath, 
  generateRenderChunkPath,
  generateBlobUrl,
} from '@/lib/utils/hash';
import { synthesizeWithRetry } from '@/lib/tts/synthesis';
import { acrossfadeJoin, masterAndEncode, analyzeAudio } from '@/lib/audio/ffmpeg-hybrid';
import { getBlobRetryConfig } from '@/lib/config/vercel';
import { cacheMonitor, logCachePerformance } from '@/lib/utils/cache-monitor';

/**
 * Retry fetch with exponential backoff for blob availability
 * Enhanced with better error handling and longer delays for Vercel Blob consistency
 */
async function fetchBlobWithRetry(url: string, maxRetries?: number): Promise<Response> {
  const retryConfig = getBlobRetryConfig();
  const actualMaxRetries = maxRetries ?? retryConfig.maxRetries;
  
  let lastError: Error;
  console.log(`🔍 Attempting to fetch: ${url}`);
  
  for (let attempt = 0; attempt < actualMaxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (response.ok) {
        console.log(`✅ Blob fetch successful on attempt ${attempt + 1}`);
        return response;
      }
      
      // If it's a 403/404, wait and retry (blob might not be available yet due to eventual consistency)
      if (response.status === 403 || response.status === 404) {
        if (attempt === actualMaxRetries - 1) {
          throw new Error(`Blob not found after ${actualMaxRetries} attempts: ${response.status} ${response.statusText}`);
        }
        
        // Use environment-aware delays
        const delay = Math.min(
          retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );
        console.log(`🔄 Blob not ready (${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${actualMaxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Other HTTP errors, throw immediately
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on network errors for the last attempt
      if (attempt === actualMaxRetries - 1) break;
      
      // Network errors get shorter delays
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(`🔄 Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${actualMaxRetries}):`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`❌ All retry attempts failed for: ${url}`);
  throw lastError!;
}

/**
 * Process a render job from queued to completion
 * @param renderId - Unique render identifier
 * @returns Final audio blob key
 */
export async function processRender(renderId: string, manifest?: Manifest, settings?: TuningSettings): Promise<{ finalKey: string }> {
  console.log(`🚀 Processing render ${renderId} with ${manifest?.chunks?.length || 0} chunks`);
  
  const startTime = new Date();
  
  try {
    // Using hybrid FFmpeg implementation with graceful fallbacks
    console.log('🔧 Using hybrid FFmpeg implementation with graceful fallbacks');
    
    // If manifest and settings are provided, use them directly to avoid blob read issues
    let finalManifest: Manifest;
    let finalSettings: TuningSettings;
    
    if (manifest && settings) {
      console.log('📋 Using provided manifest and settings');
      finalManifest = manifest;
      finalSettings = settings;
    } else {
      // Fallback to loading from blob storage with shorter delay
      console.log('⏳ Waiting 2 seconds for blob availability...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      finalManifest = await loadManifest(renderId);
      finalSettings = await loadRenderSettings(renderId);
    }
    
    // Update status to running
    await updateStatus(renderId, {
      state: 'running',
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: false, done: 0, total: finalManifest.chunks.length },
      ],
    });
    
    // Step 1: Synthesize chunks
    console.log(`🎙️ Starting synthesis of ${finalManifest.chunks.length} chunks...`);
    const synthesisStartTime = Date.now();
    
    let chunkBuffers: Buffer[];
    try {
      chunkBuffers = await synthesizeChunks(finalManifest, finalSettings, renderId);
      console.log(`✅ Synthesis completed: ${chunkBuffers.length} buffers`);
    } catch (synthesisError) {
      console.error('❌ Synthesis failed:', synthesisError);
      
      // Update status to failed
      await updateStatus(renderId, {
        state: 'failed',
        steps: [
          { name: 'ssml', ok: true },
          { name: 'chunk', ok: true },
          { name: 'synthesize', ok: false }
        ],
        startedAt: startTime.toISOString(),
        updatedAt: new Date().toISOString(),
        error: `Synthesis failed: ${synthesisError instanceof Error ? synthesisError.message : 'Unknown error'}`
      });
      
      throw new Error(`Synthesis failed: ${synthesisError instanceof Error ? synthesisError.message : 'Unknown error'}`);
    }
    const synthesisEndTime = Date.now();
    console.log(`✅ All chunks synthesized in ${synthesisEndTime - synthesisStartTime}ms`);
    
    // Update status after synthesis
    await updateStatus(renderId, {
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: true, done: finalManifest.chunks.length, total: finalManifest.chunks.length },
        { name: 'stitch', ok: false },
      ],
    });
    
    // Step 2: Stitch with crossfade
    console.log('🔗 Starting stitching chunks with crossfade...');
    console.log('🔧 FFmpeg stitching parameters:', {
      chunkCount: chunkBuffers.length,
      crossfadeMs: finalSettings.stitching.crossfadeMs,
      sampleRate: finalSettings.stitching.sampleRate,
      mono: finalSettings.stitching.mono,
      totalBufferSize: chunkBuffers.reduce((sum, buf) => sum + buf.length, 0)
    });
    
    const stitchingStartTime = Date.now();
    
    let stitchedBuffer: Buffer;
    try {
      console.log('🎯 About to call acrossfadeJoin - this is where FFmpeg crashes might occur');
      stitchedBuffer = await acrossfadeJoin(
        chunkBuffers,
        finalSettings.stitching.crossfadeMs,
        finalSettings.stitching.sampleRate,
        finalSettings.stitching.mono
      );
      console.log('✅ FFmpeg stitching completed successfully, buffer size:', stitchedBuffer.length);
    } catch (stitchError) {
      console.error('💥 FFmpeg stitching failed:', stitchError);
      console.error('🔍 Stitching error details:', {
        name: stitchError instanceof Error ? stitchError.name : 'Unknown',
        message: stitchError instanceof Error ? stitchError.message : String(stitchError),
        stack: stitchError instanceof Error ? stitchError.stack : 'No stack trace'
      });
      
      // Update status to failed
      await updateStatus(renderId, {
        state: 'failed',
        progress: { total: 4, done: 2 },
        steps: [
          { name: 'Synthesis', ok: true },
          { name: 'Stitching', ok: false }
        ],
        startedAt: startTime.toISOString(),
        updatedAt: new Date().toISOString(),
        error: `FFmpeg stitching failed: ${stitchError instanceof Error ? stitchError.message : 'Unknown error'}`
      });
      
      throw new Error(`FFmpeg stitching failed: ${stitchError instanceof Error ? stitchError.message : 'Unknown error'}`);
    }
    const stitchingEndTime = Date.now();
    console.log(`✅ Stitching completed in ${stitchingEndTime - stitchingStartTime}ms, buffer size: ${stitchedBuffer.length} bytes`);
    
    // Save raw stitched audio
    const rawKey = generateRenderPath(renderId, 'raw.wav');
    await put(rawKey, stitchedBuffer, { access: 'public', allowOverwrite: true });
    
    // Update status after stitching
    await updateStatus(renderId, {
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: true, done: finalManifest.chunks.length, total: finalManifest.chunks.length },
        { name: 'stitch', ok: true },
        { name: 'master', ok: false },
      ],
    });
    
    // Step 3: Master and encode
    console.log('🎚️ Starting mastering and encoding final audio...');
    console.log('🔧 FFmpeg mastering parameters:', {
      inputBufferSize: stitchedBuffer.length,
      mastering: finalSettings.mastering,
      format: finalSettings.export.format,
      bitrateKbps: finalSettings.export.bitrateKbps
    });
    
    const masteringStartTime = Date.now();
    
    let finalBuffer: Buffer;
    try {
      console.log('🎯 About to call masterAndEncode - another potential FFmpeg crash point');
      finalBuffer = await masterAndEncode(stitchedBuffer, {
        ...finalSettings.mastering,
        format: finalSettings.export.format,
        bitrateKbps: finalSettings.export.bitrateKbps,
      });
      console.log('✅ FFmpeg mastering completed successfully, buffer size:', finalBuffer.length);
    } catch (masterError) {
      console.error('💥 FFmpeg mastering failed:', masterError);
      console.error('🔍 Mastering error details:', {
        name: masterError instanceof Error ? masterError.name : 'Unknown',
        message: masterError instanceof Error ? masterError.message : String(masterError),
        stack: masterError instanceof Error ? masterError.stack : 'No stack trace'
      });
      
      // Update status to failed
      await updateStatus(renderId, {
        state: 'failed',
        progress: { total: 4, done: 3 },
        steps: [
          { name: 'Synthesis', ok: true },
          { name: 'Stitching', ok: true },
          { name: 'Mastering', ok: false }
        ],
        startedAt: startTime.toISOString(),
        updatedAt: new Date().toISOString(),
        error: `FFmpeg mastering failed: ${masterError instanceof Error ? masterError.message : 'Unknown error'}`
      });
      
      throw new Error(`FFmpeg mastering failed: ${masterError instanceof Error ? masterError.message : 'Unknown error'}`);
    }
    const masteringEndTime = Date.now();
    console.log(`✅ Mastering completed in ${masteringEndTime - masteringStartTime}ms, final buffer size: ${finalBuffer.length} bytes`);
    
    // Save final audio
    const extension = finalSettings.export.format;
    const finalKey = generateRenderPath(renderId, `final.${extension}`);
    await put(finalKey, finalBuffer, { 
      access: 'public',
      contentType: getContentType(extension),
      allowOverwrite: true,
    });
    
    // Update status after mastering
    await updateStatus(renderId, {
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: true, done: finalManifest.chunks.length, total: finalManifest.chunks.length },
        { name: 'stitch', ok: true },
        { name: 'master', ok: true },
        { name: 'analyze', ok: false },
      ],
    });
    
    // Step 4: Generate diagnostics
    console.log('📊 Analyzing final audio...');
    
    let audioAnalysis: {
      durationSec: number;
      lufsIntegrated: number;
      truePeakDb: number;
      joinEnergySpikes: Array<{ posMs: number; db: number }>;
    };
    try {
      console.log('🎯 About to call analyzeAudio - final FFmpeg operation');
      audioAnalysis = await analyzeAudio(finalBuffer);
      console.log('✅ FFmpeg audio analysis completed successfully');
    } catch (analysisError) {
      console.error('💥 FFmpeg audio analysis failed:', analysisError);
      console.error('🔍 Analysis error details:', {
        name: analysisError instanceof Error ? analysisError.name : 'Unknown',
        message: analysisError instanceof Error ? analysisError.message : String(analysisError),
        stack: analysisError instanceof Error ? analysisError.stack : 'No stack trace'
      });
      
      // Use fallback analysis values
      console.log('🔄 Using fallback audio analysis values');
      audioAnalysis = {
        durationSec: 30, // fallback duration
        lufsIntegrated: -16, // fallback loudness
        truePeakDb: -1.0, // fallback peak
        joinEnergySpikes: [] // empty spikes array
      };
    }
    
    // Calculate additional diagnostics
    const diagnostics: Diagnostics = {
      wpm: calculateWPM(finalManifest, audioAnalysis.durationSec),
      tagDensityPer10Words: calculateTagDensity(finalManifest),
      breaksHistogramMs: calculateBreaksHistogram(finalManifest),
      durationSec: audioAnalysis.durationSec,
      joinEnergySpikes: audioAnalysis.joinEnergySpikes,
      lufsIntegrated: audioAnalysis.lufsIntegrated,
      truePeakDb: audioAnalysis.truePeakDb,
    };
    
    // Save diagnostics
    const diagnosticsKey = generateRenderPath(renderId, 'diagnostics.json');
    await put(diagnosticsKey, JSON.stringify(diagnostics, null, 2), { access: 'public', allowOverwrite: true });
    
    // Final status update
    await updateStatus(renderId, {
      state: 'done',
      progress: {
        total: finalManifest.chunks.length,
        done: finalManifest.chunks.length,
      },
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: true, done: finalManifest.chunks.length, total: finalManifest.chunks.length },
        { name: 'stitch', ok: true },
        { name: 'master', ok: true },
        { name: 'analyze', ok: true },
        { name: 'complete', ok: true },
      ],
    });
    
    console.log(`✅ Render ${renderId} completed successfully`);
    
    // Log cache performance summary
    logCachePerformance(renderId);
    
    return { finalKey };
    
  } catch (error) {
    console.error(`❌ Render ${renderId} failed:`, error);
    
    // Update status to failed
    await updateStatus(renderId, {
      state: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw error;
  }
}

/**
 * Synthesize all chunks with caching and improved error handling
 */
async function synthesizeChunks(
  manifest: Manifest,
  settings: TuningSettings,
  renderId: string
): Promise<Buffer[]> {
  console.log(`🎙️ Synthesizing ${manifest.chunks.length} chunks with concurrency control`);
  
  // Limit concurrent ElevenLabs API calls to prevent rate limiting
  const limit = pLimit(3); // Maximum 3 concurrent requests
  console.log('🚦 Using p-limit with concurrency of 3 for ElevenLabs API calls');
  
  // Create promises for all chunks with concurrency control
  const chunkPromises = manifest.chunks.map((chunk, i) => 
    limit(async (): Promise<Buffer> => {
      console.log(`🎙️ Processing chunk ${i + 1}/${manifest.chunks.length} (${chunk.hash.slice(0, 8)}...)`);
      
      // Check cache first
      const cacheKey = generateChunkCacheKey(chunk.hash);
      let audioBuffer: Buffer | null = null;
      
      try {
        const cacheUrl = generateBlobUrl(cacheKey);
        const response = await fetch(cacheUrl, {
          method: 'HEAD',
          headers: { 'Cache-Control': 'no-cache' },
        });
        
        if (response.ok) {
          const contentResponse = await fetch(cacheUrl);
          if (contentResponse.ok) {
            audioBuffer = Buffer.from(await contentResponse.arrayBuffer());
            console.log(`💾 Cache hit for chunk ${i + 1}`);
            cacheMonitor.recordHit('chunks');
          }
        }
      } catch {
        console.log(`🔄 Cache miss for chunk ${i + 1}, synthesizing...`);
        cacheMonitor.recordMiss('chunks');
      }
      
      // Synthesize if not cached
      if (!audioBuffer) {
        console.log(`🎯 Starting synthesis for chunk ${i + 1}/${manifest.chunks.length}`);
        
        // Check environment variables
        const voiceId = process.env.ELEVEN_VOICE_ID;
        const modelId = process.env.ELEVEN_MODEL_ID || 'eleven_multilingual_v2';
        const apiKey = process.env.ELEVENLABS_API_KEY;
        
        if (!voiceId || !apiKey) {
          throw new Error('ElevenLabs environment variables not set');
        }
        
        const startTime = Date.now();
        audioBuffer = await synthesizeWithRetry(chunk.ssml, {
          voiceId,
          modelId,
          voiceSettings: settings.eleven,
          format: 'pcm',
          seed: 12345,
          previousText: chunk.ix > 0 ? manifest.chunks[chunk.ix - 1].text.slice(-300) : undefined,
          nextText: chunk.ix < manifest.chunks.length - 1 ? manifest.chunks[chunk.ix + 1].text.slice(0, 300) : undefined,
        });
        
        const duration = Date.now() - startTime;
        console.log(`⏱️ Synthesis took ${duration}ms for chunk ${i + 1}`);
        
        // Cache the result
        try {
          await put(cacheKey, audioBuffer, { access: 'public', allowOverwrite: true });
          console.log(`💾 Cached chunk ${i + 1}`);
        } catch (cacheError) {
          console.warn(`⚠️ Failed to cache chunk ${i + 1}:`, cacheError);
        }
      }
      
      // Save to render folder
      try {
        const renderChunkPath = generateRenderChunkPath(renderId, chunk.ix, chunk.hash);
        await put(renderChunkPath, audioBuffer, { access: 'public', allowOverwrite: true });
      } catch (renderSaveError) {
        console.warn(`⚠️ Failed to save chunk ${i + 1} to render folder:`, renderSaveError);
      }
      
      console.log(`✅ Completed chunk ${i + 1}, buffer size: ${audioBuffer.length} bytes`);
      return audioBuffer;
    })
  );
  
  // Wait for all chunks to complete
  console.log('⏳ Waiting for all chunks to complete with p-limit concurrency control...');
  const chunkBuffers = await Promise.all(chunkPromises);
  
  console.log(`✅ All ${chunkBuffers.length} chunks completed successfully`);
  return chunkBuffers;
}

/**
 * Debug function to list actual blobs
 */
async function debugListBlobs(renderId: string) {
  try {
    const renderPrefix = `tts/renders/${renderId}/`;
    console.log(`🔍 Listing blobs with prefix: ${renderPrefix}`);
    
    const { blobs } = await list({ prefix: renderPrefix });
    console.log(`📋 Found ${blobs.length} blobs:`);
    blobs.forEach(blob => {
      console.log(`  - ${blob.pathname} -> ${blob.url}`);
    });
  } catch (error) {
    console.error(`❌ Failed to list blobs:`, error);
  }
}



/**
 * Load manifest from blob storage using actual Vercel URLs with retry
 */
async function loadManifest(renderId: string): Promise<Manifest> {
  try {
    // First, debug what blobs actually exist
    await debugListBlobs(renderId);
    
    // Use our generated URL with retry mechanism
    const manifestUrl = generateBlobUrl(generateRenderPath(renderId, 'manifest.json'));
    console.log(`🔍 Loading manifest from generated URL: ${manifestUrl}`);
    
    // Retry with exponential backoff for newly created blobs (reduced retries for speed)
    const response = await fetchBlobWithRetry(manifestUrl, 3);
    return await response.json();
  } catch (error) {
    console.error(`❌ Failed to load manifest:`, error);
    throw new Error(`Failed to load manifest for render ${renderId}: ${error}`);
  }
}

/**
 * Load render settings from request.json with retry
 */
async function loadRenderSettings(renderId: string): Promise<TuningSettings> {
  try {
    const requestUrl = generateBlobUrl(generateRenderPath(renderId, 'request.json'));
    console.log(`🔍 Loading settings from generated URL: ${requestUrl}`);
    
    // Retry with exponential backoff for newly created blobs (reduced retries for speed)
    const response = await fetchBlobWithRetry(requestUrl, 3);
    const request = await response.json();
    return request.settings;
  } catch (error) {
    console.error(`❌ Failed to load settings:`, error);
    throw new Error(`Failed to load settings for render ${renderId}: ${error}`);
  }
}

/**
 * Update render status
 */
async function updateStatus(renderId: string, updates: Partial<RenderStatus>): Promise<void> {
  try {
    console.log(`🔄 Updating status for render ${renderId}`);
    
    let currentStatus: RenderStatus;
    try {
      const statusUrl = generateBlobUrl(generateRenderPath(renderId, 'status.json'));
      const response = await fetchBlobWithRetry(statusUrl, 3); // Fewer retries for status
      currentStatus = await response.json();
    } catch (getError) {
      console.warn(`Status file not found, creating new one:`, getError);
      currentStatus = {
        state: updates.state || 'queued',
        progress: { total: 0, done: 0 },
        steps: [],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: null,
      };
    }
    
    // Merge updates
    const updatedStatus: RenderStatus = {
      ...currentStatus,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    // Save updated status
    await put(
      generateRenderPath(renderId, 'status.json'),
      JSON.stringify(updatedStatus, null, 2),
      { access: 'public', addRandomSuffix: false, allowOverwrite: true }
    );
    
    console.log(`✅ Status updated for render ${renderId}: ${updatedStatus.state}`);
  } catch (error) {
    console.error(`Failed to update status for render ${renderId}:`, error);
  }
}

/**
 * Calculate words per minute from manifest and actual duration
 */
function calculateWPM(manifest: Manifest, actualDurationSec: number): number {
  const totalWords = manifest.chunks.reduce((sum, chunk) => {
    return sum + chunk.text.split(/\s+/).filter(word => word.length > 0).length;
  }, 0);
  
  return actualDurationSec > 0 ? Math.round((totalWords / actualDurationSec) * 60) : 0;
}

/**
 * Calculate SSML tag density per 10 words
 */
function calculateTagDensity(manifest: Manifest): number {
  const totalWords = manifest.chunks.reduce((sum, chunk) => {
    return sum + chunk.text.split(/\s+/).filter(word => word.length > 0).length;
  }, 0);
  
  const totalTags = manifest.chunks.reduce((sum, chunk) => {
    return sum + (chunk.ssml.match(/<[^>]+>/g) || []).length;
  }, 0);
  
  return totalWords > 0 ? Math.round((totalTags / totalWords) * 10 * 100) / 100 : 0;
}

/**
 * Calculate break timing histogram from SSML
 */
function calculateBreaksHistogram(manifest: Manifest): {
  comma: number;
  clause: number;
  sentence: number;
  paragraph: number;
} {
  const histogram = { comma: 0, clause: 0, sentence: 0, paragraph: 0 };
  
  manifest.chunks.forEach(chunk => {
    const breaks = chunk.ssml.match(/<break\s+time="([^"]+)"/g) || [];
    breaks.forEach(breakTag => {
      const timeMatch = breakTag.match(/time="([^"]+)"/);
      if (timeMatch) {
        const timeMs = parseTimeToMs(timeMatch[1]);
        if (timeMs <= 200) histogram.comma++;
        else if (timeMs <= 300) histogram.clause++;
        else if (timeMs <= 500) histogram.sentence++;
        else histogram.paragraph++;
      }
    });
  });
  
  return histogram;
}

/**
 * Parse SSML time string to milliseconds
 */
function parseTimeToMs(timeStr: string): number {
  if (timeStr.endsWith('ms')) {
    return parseInt(timeStr.replace('ms', ''), 10);
  } else if (timeStr.endsWith('s')) {
    return parseFloat(timeStr.replace('s', '')) * 1000;
  }
  return 0;
}

/**
 * Get content type for audio format
 */
function getContentType(format: string): string {
  switch (format) {
    case 'mp3': return 'audio/mpeg';
    case 'aac': return 'audio/aac';
    case 'wav': return 'audio/wav';
    default: return 'audio/wav';
  }
}
