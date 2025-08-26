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
  applyAudioTags, // NEW: Audio tags for emotional delivery
  processForNaturalTTS, // NEW: Natural processing for v3
  convertPausesToNatural, // NEW: Convert pauses to natural punctuation
  validateNaturalText, // NEW: Validate natural text
  toSSML,
  chunk,
  type TextChunk,
  type LintReport,
  type NaturalProcessingResult,
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
    const { text, output, processingMode } = PrepareRequestSchema.parse(body);

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
async function processNaturalMode(text: string, config: VoiceConfig, _output: string) {
  try {
    console.log('🌿 Natural Mode - Step 1: Converting pauses to natural punctuation');
    console.log('📝 Original text:', text.substring(0, 100) + '...');
    
    // Step 1: Convert any existing pause markup to natural punctuation
    const naturalText = convertPausesToNatural(text);
    console.log('🔄 After pause conversion:', naturalText.substring(0, 100) + '...');
    
    // Step 2: Process for natural TTS with audio tags
    console.log('🌿 Natural Mode - Step 2: Applying audio tags');
    const naturalResult = processForNaturalTTS(naturalText, config);
    console.log('🎭 After audio tags:', naturalResult.text.substring(0, 100) + '...');
    console.log('🏷️ Audio tags found:', naturalResult.audioTags);
    
    // Step 3: Validate the result
    const validation = validateNaturalText(naturalResult.text);
    
    // Step 4: Create simple chunks (no complex chunking needed for natural approach)
    const chunks = createNaturalChunks(naturalResult.text);
    
    // Step 5: Generate manifest
    const manifestId = await saveManifest(chunks, {
      report: { 
        warnings: validation.issues, 
        bans: [],
        stats: {
          words: naturalResult.text.split(/\s+/).length,
          sentences: naturalResult.text.split(/[.!?]+/).length - 1,
          groupAddressRatio: 0, // Not applicable for natural processing
          consecutiveGroupAddress: 0 // Not applicable for natural processing
        }
      },
      configVersion: 'natural-v1',
      originalText: text,
    });

    return NextResponse.json({
      manifestId,
      chunks,
      report: {
        warnings: validation.issues,
        bans: []
      },
      processing: {
        originalText: text,
        naturalConverted: naturalText,
        withAudioTags: naturalResult.text,
        finalOutput: naturalResult.text,
        audioTags: naturalResult.audioTags,
        naturalPauses: naturalResult.naturalPauses,
        pipeline: [
          { step: 'pause_conversion', description: 'Convert pause markup to natural punctuation' },
          { step: 'natural_processing', description: 'Apply natural TTS processing with audio tags' },
          { step: 'validation', description: 'Validate natural text format' },
        ]
      }
    });

  } catch (error) {
    console.error('Natural processing error:', error);
    return NextResponse.json({ error: 'Failed to process text naturally' }, { status: 500 });
  }
}

/**
 * Create simple chunks for natural processing
 */
function createNaturalChunks(text: string) {
  // Split by paragraph breaks, keeping natural flow
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  return paragraphs.map((paragraph, index) => ({
    id: index,
    body: paragraph.trim(),
    charCount: paragraph.trim().length,
    estSeconds: Math.max(3, Math.ceil(paragraph.length / 15)) // Rough estimate: 15 chars per second
  }));
}
