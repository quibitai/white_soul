/**
 * Server action to start a render job
 * Implements the dev_plan_02 blob-only architecture with content-addressable caching
 */

'use server';

// Vercel function configuration for long-running synthesis
export const maxDuration = 300; // 5 minutes for ElevenLabs API calls
export const dynamic = 'force-dynamic';

import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { 
  TuningSettingsSchema, 
  type RenderRequest,
  type RenderStatus,
  type Manifest,
} from '@/lib/types/tuning';
import { annotateTextToSSML } from '@/lib/styling/annotate';
import { makeChunks } from '@/lib/styling/segment';

import { 
  generateScriptHash, 
  generateSettingsHash, 
  generateRenderPath,
  generateBlobUrl
} from '@/lib/utils/hash';

/**
 * Input schema for startRender action
 */
const StartRenderInputSchema = z.object({
  rawScript: z.string().min(1, 'Script is required').max(50000, 'Script too long'),
  settings: TuningSettingsSchema,
});

export type StartRenderInput = z.infer<typeof StartRenderInputSchema>;

/**
 * Result of starting a render job
 */
export interface StartRenderResult {
  /** Unique render identifier */
  renderId: string;
  /** Script and settings hashes for caching */
  hashes: {
    scriptHash: string;
    settingsHash: string;
  };
  /** Processing statistics */
  stats: {
    chunks: number;
    estimatedDuration: number;
    ssmlTags: number;
  };
  /** Any warnings from processing */
  warnings: string[];
}

/**
 * Start a new render job with blob-only storage
 * @param input - Raw script and tuning settings
 * @returns Render job information
 */
export async function startRender(input: StartRenderInput): Promise<StartRenderResult> {
  console.log(`🎬 startRender function called at ${new Date().toISOString()}`);
  console.log(`📝 Input received:`, { scriptLength: input.rawScript?.length || 0, hasSettings: !!input.settings });
  
  // Validate input
  const { rawScript, settings } = StartRenderInputSchema.parse(input);
  
  // Generate unique render ID
  const renderId = nanoid();
  
  console.log(`🚀 Starting render ${renderId}`);
  
  try {
    // Generate content hashes for caching (used in request.json)
    const scriptHash = generateScriptHash(rawScript);
    const settingsHash = generateSettingsHash(settings);
    
    console.log(`📝 Hashes: script=${scriptHash.slice(0, 8)}..., settings=${settingsHash.slice(0, 8)}...`);
    
    // Step 1: Annotate text to SSML with diagnostics
    console.log('🎙️ Annotating text to SSML...');
    const annotationResult = await annotateTextToSSML(rawScript, settings);
    
    // Step 2: Create semantic chunks with overlap and context
    console.log('✂️ Creating semantic chunks...');
    const chunkingResult = makeChunks(annotationResult.ssml, settings);
    
    if (chunkingResult.chunks.length === 0) {
      throw new Error('No chunks generated from input text');
    }
    
    console.log(`📦 Generated ${chunkingResult.chunks.length} chunks`);
    
    // Step 3: Create request.json (immutable record)
    const request: RenderRequest = {
      version: 1,
      rawScript,
      settings,
      derived: {
        scriptHash,
        settingsHash,
      },
    };
    
    await put(
      generateRenderPath(renderId, 'request.json'),
      JSON.stringify(request, null, 2),
      { access: 'public', allowOverwrite: true }
    );
    
    // Step 4: Save SSML output
    await put(
      generateRenderPath(renderId, 'ssml.xml'),
      annotationResult.ssml,
      { 
        access: 'public',
        contentType: 'application/xml',
        allowOverwrite: true,
      }
    );
    
    // Step 5: Create manifest.json
    const manifest: Manifest = {
      scriptHash,
      settingsHash,
      chunking: {
        maxSec: settings.chunking.maxSec,
        overlapMs: settings.chunking.overlapMs,
        contextSentences: settings.chunking.contextSentences,
      },
      chunks: chunkingResult.chunks.map(chunk => ({
        ix: chunk.ix,
        text: chunk.text,
        ssml: chunk.ssml,
        hash: chunk.hash,
        blob: chunk.blob,
      })),
    };
    
    const manifestPath = generateRenderPath(renderId, 'manifest.json');
    const manifestBlob = await put(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      { access: 'public', allowOverwrite: true }
    );
    // Store actual blob URLs in a metadata file for reliable access
    const blobMetadata = {
      manifest: manifestBlob.url,
    };
    
    await put(
      generateRenderPath(renderId, 'blob-urls.json'),
      JSON.stringify(blobMetadata, null, 2),
      { access: 'public', allowOverwrite: true }
    );
    
    console.log('📦 Manifest blob created:');
    console.log('  - Vercel URL:', manifestBlob.url);
    console.log('  - Our URL:   ', generateBlobUrl(manifestPath));
    
    // Step 6: Create initial status.json
    const initialStatus: RenderStatus = {
      state: 'queued',
      progress: {
        total: chunkingResult.chunks.length,
        done: 0,
      },
      steps: [
        { name: 'ssml', ok: true },
        { name: 'chunk', ok: true },
        { name: 'synthesize', ok: false, done: 0, total: chunkingResult.chunks.length },
      ],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
    };
    
    await put(
      generateRenderPath(renderId, 'status.json'),
      JSON.stringify(initialStatus, null, 2),
      { access: 'public', allowOverwrite: true }
    );
    
    // Calculate statistics
    const totalDuration = chunkingResult.chunks.reduce(
      (sum, chunk) => sum + chunk.estSeconds, 
      0
    );
    
    const ssmlTagCount = (annotationResult.ssml.match(/<[^>]+>/g) || []).length;
    
    console.log(`✅ Render ${renderId} initialized successfully`);
    
    // Start processing asynchronously via API call to avoid blocking the UI
    // This allows the UI to show progress immediately while processing continues
    console.log('🚀 Starting processing via API call...');
    
    // Start processing asynchronously using direct function call to avoid authentication issues
    console.log(`🚀 Starting direct processing for render ${renderId}`);
    console.log(`🌍 Current environment: NODE_ENV=${process.env.NODE_ENV}, VERCEL=${process.env.VERCEL}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    // Import and call processRender directly to avoid internal HTTP calls
    (async () => {
      try {
        console.log(`🔄 Starting dynamic import for processRender (${renderId})`);
        console.log(`📂 Import path: @/lib/workers/processRender`);
        
        const moduleImport = await import('@/lib/workers/processRender');
        console.log(`✅ Dynamic import successful, module keys:`, Object.keys(moduleImport));
        
        const { processRender } = moduleImport;
        console.log(`🔍 processRender function type:`, typeof processRender);
        
        if (!processRender) {
          throw new Error('processRender function not found in imported module');
        }
        
        console.log(`📋 About to call processRender with:`);
        console.log(`  - renderId: ${renderId}`);
        console.log(`  - manifest chunks: ${manifest.chunks.length}`);
        console.log(`  - settings preview: ${JSON.stringify(settings).slice(0, 100)}...`);
        
        console.log(`🎯 CALLING processRender NOW for ${renderId}`);
        const result = await processRender(renderId, manifest, settings);
        console.log(`🎉 Direct processing completed successfully for ${renderId}:`, result);
      } catch (processError) {
        console.error(`💥 Direct processing failed for render ${renderId}:`, processError);
        console.error(`🔍 Error details:`, {
          name: processError instanceof Error ? processError.name : 'Unknown',
          message: processError instanceof Error ? processError.message : String(processError),
          stack: processError instanceof Error ? processError.stack : 'No stack trace'
        });
        
        // Update status to failed with detailed error info
        try {
          console.log(`🔄 Updating status to failed for ${renderId}`);
          const { put } = await import('@vercel/blob');
          const errorStatus = {
            state: 'failed' as const,
            progress: { total: 0, done: 0 },
            steps: [],
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            error: processError instanceof Error ? processError.message : 'Processing failed',
          };
          
          await put(
            generateRenderPath(renderId, 'status.json'),
            JSON.stringify(errorStatus, null, 2),
            { access: 'public', allowOverwrite: true }
          );
          console.log(`✅ Error status updated for ${renderId}`);
        } catch (statusError) {
          console.error(`💥 Failed to update error status for ${renderId}:`, statusError);
        }
      }
    })();
    
    return {
      renderId,
      hashes: {
        scriptHash,
        settingsHash,
      },
      stats: {
        chunks: chunkingResult.chunks.length,
        estimatedDuration: Math.round(totalDuration * 10) / 10,
        ssmlTags: ssmlTagCount,
      },
      warnings: [
        ...annotationResult.diagnostics.textStats.words === 0 ? ['Empty text content'] : [],
        ...chunkingResult.warnings,
      ],
    };
    
  } catch (error) {
    console.error(`❌ Failed to start render ${renderId}:`, error);
    
    // Try to save error status
    try {
      const errorStatus: RenderStatus = {
        state: 'failed',
        progress: { total: 0, done: 0 },
        steps: [
          { name: 'initialization', ok: false },
        ],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      await put(
        generateRenderPath(renderId, 'status.json'),
        JSON.stringify(errorStatus, null, 2),
        { access: 'public', allowOverwrite: true }
      );
    } catch (statusError) {
      console.error('Failed to save error status:', statusError);
    }
    
    throw error;
  }
}

/**
 * Check if a render with the same content already exists
 * @param scriptHash - Hash of the script content
 * @param settingsHash - Hash of the settings
 * @returns Existing render ID if found, null otherwise
 */
export async function findExistingRender(): Promise<string | null> {
  // TODO: Implement cache lookup by listing blob storage
  // For now, always create new renders
  // In a future version, we could:
  // 1. List all renders in tts/renders/
  // 2. Check their manifest.json files for matching hashes
  // 3. Return the renderId if found
  
  return null;
}

/**
 * Get render status by ID
 * @param renderId - Render identifier
 * @returns Current render status
 */
export async function getRenderStatus(renderId: string): Promise<RenderStatus | null> {
  try {
    const response = await fetch(
      `${process.env.BLOB_READ_WRITE_TOKEN ? 'https://blob.vercel-storage.com' : ''}/tts/renders/${renderId}/status.json`
    );
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to get status for render ${renderId}:`, error);
    return null;
  }
}

/**
 * Update render status
 * @param renderId - Render identifier
 * @param updates - Status updates to apply
 */
export async function updateRenderStatus(
  renderId: string,
  updates: Partial<RenderStatus>
): Promise<void> {
  try {
    // Get current status
    const currentStatus = await getRenderStatus(renderId);
    if (!currentStatus) {
      throw new Error(`Render ${renderId} not found`);
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
      { access: 'public', allowOverwrite: true }
    );
    
  } catch (error) {
    console.error(`Failed to update status for render ${renderId}:`, error);
    throw error;
  }
}
