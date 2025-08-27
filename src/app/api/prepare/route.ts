/**
 * API route for text preparation and processing
 * Handles normalization, linting, macro application, and chunking
 * according to Angela voice styling guidelines.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  loadConfig,
  normalize,
  lint,
  applyMacros,
  applyConversationalRealism,
  applyWST2Rules,
  sanitizeForTTS,
  applyAudioTags, // Audio tags for v3 emotional delivery
  toSSML,
  chunk,
  type TextChunk,
  type LintReport,

  type VoiceConfig,
} from '@/lib/styling';
import { saveManifest } from '@/lib/store';

/**
 * Request schema validation
 */
const PrepareRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  output: z.enum(['ssml', 'text']).default('ssml'),
  preset: z.string().default('angela'),
  processingMode: z.enum(['traditional', 'natural']).optional().default('traditional'),
});



/**
 * Response interface
 */
interface PrepareResponse {
  manifestId: string;
  chunks: Array<{
    id: number;
    body: string;
    estSeconds: number;
  }>;
  report: LintReport;
  processing?: {
    originalText: string;
    normalized: string;
    withMacros: string;
    conversational: string;
    wst2Formatted: string;
    withAudioTags: string; // NEW: Audio tags processing step
    sanitized: string;
    finalOutput: string;
    pipeline: Array<{
      step: string;
      description: string;
    }>;
  };
}

/**
 * POST /api/prepare
 * Processes raw text through the complete styling pipeline
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await req.json();
    console.log('🔍 Raw request body:', { 
      processingMode: body.processingMode, 
      hasText: !!body.text,
      textLength: body.text?.length 
    });
    
    const { text, output, processingMode } = PrepareRequestSchema.parse(body);
    console.log('🔍 After schema validation:', { processingMode, output });

    // Check input length limits
    const maxChars = parseInt(process.env.MAX_INPUT_CHARS || '20000');
    if (text.length > maxChars) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${maxChars} characters allowed.` },
        { status: 400 }
      );
    }

    // Load voice configuration
    const config = await loadConfig();

    // Choose processing approach based on mode
    console.log('🔄 Processing mode decision:', { processingMode, text: text.substring(0, 50) + '...' });
    
    if (processingMode === 'natural') {
      console.log('🌿 Using Natural Processing Mode');
      return await processNaturalMode(text, config, output);
    }
    
    console.log('⚙️ Using Traditional Processing Mode');

    // Traditional processing pipeline
    const normalized = normalize(text, config);
    const report = lint(normalized, config);
    const withMacros = applyMacros(normalized, config);
    const conversational = applyConversationalRealism(withMacros, config);
    const wst2Formatted = applyWST2Rules(conversational, config);
    const withAudioTags = applyAudioTags(wst2Formatted, config); // NEW: Audio tags processing
    const sanitized = sanitizeForTTS(withAudioTags, config);
    const chunks = chunk(sanitized, config);

    // Convert to SSML or keep as text based on output preference
    const processedChunks: TextChunk[] = chunks.map((chunk) => ({
      ...chunk,
      body: output === 'ssml' && config.emphasis.use_ssml 
        ? toSSML(chunk.body, config) 
        : chunk.body,
    }));

    // Save manifest for later synthesis
    const manifestId = await saveManifest(processedChunks, {
      report,
      configVersion: '2025-01-27',
      originalText: text,
    });

    // Prepare response with processing annotations
    const response: PrepareResponse = {
      manifestId,
      chunks: processedChunks.map(chunk => ({
        id: chunk.id,
        body: chunk.body,
        estSeconds: chunk.estSeconds,
      })),
      report,
      processing: {
        originalText: text,
        normalized: normalized,
        withMacros: withMacros,
        conversational: conversational,
        wst2Formatted: wst2Formatted,
        withAudioTags: withAudioTags, // NEW: Audio tags processing step
        sanitized: sanitized,
        finalOutput: processedChunks.map(chunk => chunk.body).join('\n\n'),
        pipeline: [
          { step: 'normalize', description: 'Text normalization and cleanup' },
          { step: 'lint', description: 'Style analysis and warnings' },
          { step: 'macros', description: 'Pause and emphasis macro insertion' },
          { step: 'conversational', description: 'Conversational realism enhancements' },
          { step: 'wst2', description: 'WST2 Studio Speech Rules formatting' },
          { step: 'audio_tags', description: 'ElevenLabs audio tags for emotional delivery' }, // NEW
          { step: 'sanitize', description: 'TTS artifact removal and cleanup' },
          { step: 'chunk', description: 'Text segmentation for TTS' },
          { step: 'ssml', description: output === 'ssml' ? 'SSML conversion applied' : 'Text output (no SSML conversion)' },
        ],
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in /api/prepare:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prepare
 * Returns API documentation and usage information
 */
export async function GET(): Promise<NextResponse> {
  const documentation = {
    endpoint: '/api/prepare',
    method: 'POST',
    description: 'Processes raw text through Angela voice styling pipeline',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Raw text to process for TTS synthesis',
        maxLength: parseInt(process.env.MAX_INPUT_CHARS || '20000'),
      },
      output: {
        type: 'string',
        required: false,
        default: 'ssml',
        enum: ['ssml', 'text'],
        description: 'Output format preference',
      },
      preset: {
        type: 'string',
        required: false,
        default: 'angela',
        description: 'Voice preset to use for processing',
      },
    },
    response: {
      manifestId: 'string - Unique identifier for the processed text',
      chunks: 'array - Text chunks ready for synthesis',
      report: 'object - Linting report with warnings and statistics',
    },
    example: {
      request: {
        text: 'Hello, you guys. This is a test of the Angela voice system.',
        output: 'ssml',
        preset: 'angela',
      },
      response: {
        manifestId: 'uuid-string',
        chunks: [
          {
            id: 0,
            body: '<speak>Hello, you guys. This is a test of the Angela voice system.</speak>',
            estSeconds: 4.2,
          },
        ],
        report: {
          warnings: [],
          bans: [],
          stats: {
            words: 12,
            sentences: 2,
            groupAddressRatio: 0.5,
            consecutiveGroupAddress: 1,
          },
        },
      },
    },
  };

  return NextResponse.json(documentation);
}

/**
 * Natural processing mode for ElevenLabs v3
 * Simplified pipeline focused on natural text and audio tags
 */
async function processNaturalMode(text: string, config: VoiceConfig, output: string) {
  try {
    console.log('🎭 v3 Comprehensive Pipeline - Starting full processing');
    console.log('📝 Original text:', text.substring(0, 100) + '...');
    
    // Step 1: Complete processing pipeline (normalize → lint → macros → conversational → wst2)
    console.log('🔧 Step 1: Full text processing pipeline');
    let processedText = normalize(text, config);
    const lintReport = lint(processedText, config);
    processedText = applyMacros(processedText, config);
    processedText = applyConversationalRealism(processedText, config);
    processedText = applyWST2Rules(processedText, config);
    console.log('✅ After full processing:', processedText.substring(0, 100) + '...');
    
    // Step 2: Apply comprehensive audio tags for v3
    console.log('🎭 Step 2: Applying comprehensive v3 audio tags');
    const taggedText = applyAudioTags(processedText, config);
    console.log('🏷️ After audio tags:', taggedText.substring(0, 100) + '...');
    
    // Step 3: Final sanitization (model-aware for v3)
    console.log('🧹 Step 3: Model-aware sanitization for v3');
    const cleanText = sanitizeForTTS(taggedText, config);
    console.log('✨ After sanitization:', cleanText.substring(0, 100) + '...');
    
    // Step 4: SSML conversion if needed
    let finalText = cleanText;
    if (config.emphasis?.use_ssml && output === 'ssml') {
      console.log('📄 Converting to SSML');
      finalText = toSSML(cleanText, config);
    }
    
    // Step 5: Optimized chunking for v3
    console.log('✂️ Step 4: Creating optimized chunks for v3');
    const chunks = chunk(finalText, config);
    console.log(`📦 Created ${chunks.length} chunks (avg: ${Math.round(chunks.reduce((sum, c) => sum + c.charCount, 0) / chunks.length)} chars each)`);
    
    // Step 6: Count and log audio tags for validation
    const audioTagMatches = finalText.match(/\[[\w\s]+\]/g) || [];
    console.log(`🎯 Audio tags in final text: ${audioTagMatches.length} tags found`);
    if (audioTagMatches.length > 0) {
      console.log('🏷️ Audio tags list:', audioTagMatches.slice(0, 10).join(', ') + (audioTagMatches.length > 10 ? '...' : ''));
    }
    
    // Step 7: Generate manifest
    const manifestId = await saveManifest(chunks, {
      report: { 
        warnings: lintReport.warnings, 
        bans: lintReport.bans,
        stats: lintReport.stats
      },
      configVersion: 'comprehensive-v3',
      originalText: text,
    });

    return NextResponse.json({
      manifestId,
      chunks,
      report: {
        warnings: lintReport.warnings,
        bans: lintReport.bans
      },
      processing: {
        originalText: text,
        processedText: processedText,
        withAudioTags: taggedText,
        finalOutput: finalText,
        audioTags: audioTagMatches,
        chunkCount: chunks.length,
        avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.charCount, 0) / chunks.length),
        pipeline: [
          { step: 'normalization', description: 'Text normalization and cleanup' },
          { step: 'linting', description: 'Style and content validation' },
          { step: 'macros', description: 'Apply voice macros and shortcuts' },
          { step: 'conversational', description: 'Apply conversational realism' },
          { step: 'wst2_rules', description: 'Apply WST2 styling rules' },
          { step: 'audio_tags', description: 'Apply comprehensive v3 audio tags' },
          { step: 'sanitization', description: 'Final cleanup preserving audio tags' },
          { step: 'chunking', description: 'Optimized chunking for v3' }
        ]
      }
    });

  } catch (error) {
    console.error('❌ v3 processing error:', error);
    return NextResponse.json({ error: 'Failed to process text with v3 pipeline' }, { status: 500 });
  }
}


