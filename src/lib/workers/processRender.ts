/**
 * Process render worker for dev_plan_02 architecture
 * Handles synthesis, caching, stitching, and mastering
 */

import { put } from '@vercel/blob';
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
 * Process a render job from queued to completion
 * @param renderId - Unique render identifier
 * @returns Final audio blob key
 */
export async function processRender(renderId: string): Promise<{ finalKey: string }> {
  console.log(`🔄 Processing render ${renderId}`);
  
  try {
    // Load manifest and current status
    const manifest = await loadManifest(renderId);
    const settings = await loadRenderSettings(renderId);
    
    // Update status to running
    await updateStatus(renderId, {
      state: 'running',
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: false, done: 0, total: manifest.chunks.length },
      ],
    });
    
    // Step 1: Synthesize or reuse chunks
    console.log(`🎙️ Synthesizing ${manifest.chunks.length} chunks...`);
    const chunkBuffers = await synthesizeChunks(manifest, settings, renderId);
    
    // Update status after synthesis
    await updateStatus(renderId, {
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: true, done: manifest.chunks.length, total: manifest.chunks.length },
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
    await put(rawKey, stitchedBuffer, { access: 'public' });
    
    // Update status after stitching
    await updateStatus(renderId, {
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: true, done: manifest.chunks.length, total: manifest.chunks.length },
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
    });
    
    // Update status after mastering
    await updateStatus(renderId, {
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: true, done: manifest.chunks.length, total: manifest.chunks.length },
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
      wpm: calculateWPM(manifest, audioAnalysis.durationSec),
      tagDensityPer10Words: calculateTagDensity(manifest),
      breaksHistogramMs: calculateBreaksHistogram(manifest),
      durationSec: audioAnalysis.durationSec,
      joinEnergySpikes: audioAnalysis.joinEnergySpikes,
      lufsIntegrated: audioAnalysis.lufsIntegrated,
      truePeakDb: audioAnalysis.truePeakDb,
    };
    
    // Save diagnostics
    const diagnosticsKey = generateRenderPath(renderId, 'diagnostics.json');
    await put(diagnosticsKey, JSON.stringify(diagnostics, null, 2), { access: 'public' });
    
    // Final status update
    await updateStatus(renderId, {
      state: 'done',
      progress: {
        total: manifest.chunks.length,
        done: manifest.chunks.length,
      },
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: true, done: manifest.chunks.length, total: manifest.chunks.length },
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
      const response = await fetch(cacheUrl);
      if (response.ok) {
        audioBuffer = Buffer.from(await response.arrayBuffer());
        console.log(`💾 Cache hit for chunk ${i}`);
      } else {
        console.log(`🔄 Cache miss for chunk ${i}, synthesizing...`);
      }
    } catch (error) {
      console.log(`🔄 Cache miss for chunk ${i}, synthesizing...`);
    }
    
    // Synthesize if not cached
    if (!audioBuffer) {
      audioBuffer = await synthesizeWithRetry(chunk.ssml, {
        voiceId: process.env.ELEVEN_VOICE_ID!,
        modelId: process.env.ELEVEN_MODEL_ID || 'eleven_multilingual_v2',
        voiceSettings: settings.eleven,
        format: 'wav', // Always use WAV for processing
        seed: 12345, // Deterministic seed
        previousText: chunk.ix > 0 ? manifest.chunks[chunk.ix - 1].text.slice(-300) : undefined,
        nextText: chunk.ix < manifest.chunks.length - 1 ? manifest.chunks[chunk.ix + 1].text.slice(0, 300) : undefined,
      });
      
      // Cache the result
      await put(cacheKey, audioBuffer, { access: 'public' });
      console.log(`💾 Cached chunk ${i}`);
    }
    
    // Also save to render folder
    const renderChunkPath = generateRenderChunkPath(renderId, chunk.ix, chunk.hash);
    await put(renderChunkPath, audioBuffer, { access: 'public' });
    
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
 * Load manifest from blob storage
 */
async function loadManifest(renderId: string): Promise<Manifest> {
  try {
    const manifestUrl = generateBlobUrl(generateRenderPath(renderId, 'manifest.json'));
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to load manifest for render ${renderId}: ${error}`);
  }
}

/**
 * Load render settings from request.json
 */
async function loadRenderSettings(renderId: string): Promise<TuningSettings> {
  try {
    const requestUrl = generateBlobUrl(generateRenderPath(renderId, 'request.json'));
    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const request = await response.json();
    return request.settings;
  } catch (error) {
    throw new Error(`Failed to load settings for render ${renderId}: ${error}`);
  }
}

/**
 * Update render status
 */
async function updateStatus(renderId: string, updates: Partial<RenderStatus>): Promise<void> {
  try {
    // Get current status
    const statusUrl = generateBlobUrl(generateRenderPath(renderId, 'status.json'));
    const response = await fetch(statusUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const currentStatus: RenderStatus = await response.json();
    
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
      { access: 'public' }
    );
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
