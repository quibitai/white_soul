/**
 * Process render worker for dev_plan_02 architecture
 * Handles synthesis, caching, stitching, and mastering
 */

import { put, list } from '@vercel/blob';
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
import { acrossfadeJoin, masterAndEncode, analyzeAudio } from '@/lib/audio/ffmpeg';

/**
 * Retry fetch with exponential backoff for blob availability
 */
async function fetchWithRetry(url: string, maxRetries: number = 5): Promise<Response> {
  let lastError: Error;
  console.log(`🔍 Attempting to fetch: ${url}`);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ Blob fetch successful on attempt ${attempt + 1}`);
        return response;
      }
      
      // If it's a 403/404, wait and retry (blob might not be available yet)
      if (response.status === 403 || response.status === 404) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
        console.log(`🔄 Blob not ready (${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Other errors, throw immediately
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries - 1) break;
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(`🔄 Fetch failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, error);
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
  console.log(`🔄 Processing render ${renderId}`);
  
  try {
    // If manifest and settings are provided, use them directly to avoid blob read issues
    let finalManifest: Manifest;
    let finalSettings: TuningSettings;
    
    if (manifest && settings) {
      console.log('📋 Using provided manifest and settings');
      finalManifest = manifest;
      finalSettings = settings;
    } else {
      // Fallback to loading from blob storage with delay
      console.log('⏳ Waiting 10 seconds for blob availability...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
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
    
    // Step 1: Synthesize or reuse chunks
    console.log(`🎙️ Synthesizing ${finalManifest.chunks.length} chunks...`);
    const chunkBuffers = await synthesizeChunks(finalManifest, finalSettings, renderId);
    
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
    console.log('🔗 Stitching chunks with crossfade...');
    const stitchedBuffer = await acrossfadeJoin(
      chunkBuffers,
      settings.stitching.crossfadeMs,
      settings.stitching.sampleRate,
      settings.stitching.mono
    );
    
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
    console.log('🎚️ Mastering and encoding final audio...');
    const finalBuffer = await masterAndEncode(stitchedBuffer, {
      ...settings.mastering,
      format: settings.export.format,
      bitrateKbps: settings.export.bitrateKbps,
    });
    
    // Save final audio
    const extension = settings.export.format;
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
    const audioAnalysis = await analyzeAudio(finalBuffer);
    
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
 * Synthesize all chunks with caching
 */
async function synthesizeChunks(
  manifest: Manifest,
  settings: TuningSettings,
  renderId: string
): Promise<Buffer[]> {
  const chunkBuffers: Buffer[] = [];
  
  for (let i = 0; i < manifest.chunks.length; i++) {
    const chunk = manifest.chunks[i];
    console.log(`🎙️ Processing chunk ${i + 1}/${manifest.chunks.length} (${chunk.hash.slice(0, 8)}...)`);
    
    // Check cache first
    const cacheKey = generateChunkCacheKey(chunk.hash);
    let audioBuffer: Buffer | null = null;
    
    try {
      const cacheUrl = generateBlobUrl(cacheKey);
      const response = await fetchWithRetry(cacheUrl, 2); // Quick check for cache
      audioBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`💾 Cache hit for chunk ${i}`);
    } catch (error) {
      console.log(`🔄 Cache miss for chunk ${i}, synthesizing...`);
    }
    
    // Synthesize if not cached
    if (!audioBuffer) {
      audioBuffer = await synthesizeWithRetry(chunk.ssml, {
        voiceId: process.env.ELEVEN_VOICE_ID!,
        modelId: process.env.ELEVEN_MODEL_ID || 'eleven_multilingual_v2',
        voiceSettings: settings.eleven,
        format: 'pcm', // Use PCM format for ElevenLabs compatibility
        seed: 12345, // Deterministic seed
        previousText: chunk.ix > 0 ? manifest.chunks[chunk.ix - 1].text.slice(-300) : undefined,
        nextText: chunk.ix < manifest.chunks.length - 1 ? manifest.chunks[chunk.ix + 1].text.slice(0, 300) : undefined,
      });
      
      // Cache the result
      await put(cacheKey, audioBuffer, { access: 'public', allowOverwrite: true });
      console.log(`💾 Cached chunk ${i}`);
    }
    
    // Also save to render folder
    const renderChunkPath = generateRenderChunkPath(renderId, chunk.ix, chunk.hash);
    await put(renderChunkPath, audioBuffer, { access: 'public', allowOverwrite: true });
    
    chunkBuffers.push(audioBuffer);
    
    // Update progress
    await updateStatus(renderId, {
      progress: {
        total: manifest.chunks.length,
        done: i + 1,
      },
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: false, done: i + 1, total: manifest.chunks.length },
      ],
    });
  }
  
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
 * Verify blob accessibility before proceeding
 */
async function verifyBlobAccessibility(renderId: string): Promise<void> {
  const manifestUrl = generateBlobUrl(generateRenderPath(renderId, 'manifest.json'));
  const maxAttempts = 10;
  
  console.log('🔍 Verifying blob accessibility...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(manifestUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✅ Blob accessible on attempt ${attempt}`);
        return;
      }
      
      console.log(`⏳ Blob not accessible (${response.status}), waiting... (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`⏳ Blob check failed, waiting... (${attempt}/${maxAttempts}):`, error);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('Blob never became accessible after verification attempts');
}

/**
 * Get actual blob URL from Vercel Blob list
 */
async function getActualBlobUrl(renderId: string, filename: string): Promise<string> {
  const renderPrefix = `tts/renders/${renderId}/`;
  const targetPath = `${renderPrefix}${filename}`;
  
  const { blobs } = await list({ prefix: renderPrefix });
  const blob = blobs.find(b => b.pathname === targetPath);
  
  if (!blob) {
    throw new Error(`Blob not found: ${targetPath}`);
  }
  
  return blob.url;
}

/**
 * Fetch blob with retry and exponential backoff for newly created blobs
 */
async function fetchBlobWithRetry(url: string, maxRetries: number = 5): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 Fetching blob (attempt ${attempt}/${maxRetries}): ${url}`);
      
      const response = await fetch(url);
      
      if (response.ok) {
        console.log(`✅ Blob fetch successful on attempt ${attempt}`);
        return response;
      }
      
      // If it's a 403/404, it might be eventual consistency - retry
      if (response.status === 403 || response.status === 404) {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Cap at 10s
          console.log(`⏳ Blob not ready (${response.status}), retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
      } else {
        // Other HTTP errors - don't retry
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`❌ Fetch error (attempt ${attempt}), retrying in ${delayMs}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`Failed to fetch blob after ${maxRetries} attempts: ${lastError?.message}`);
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
    
    // Retry with exponential backoff for newly created blobs
    const response = await fetchBlobWithRetry(manifestUrl, 5);
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
    
    // Retry with exponential backoff for newly created blobs
    const response = await fetchBlobWithRetry(requestUrl, 5);
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
