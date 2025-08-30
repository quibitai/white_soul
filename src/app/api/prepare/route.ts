/**
 * API route for text preparation and processing
 * Handles normalization, linting, macro application, and chunking
 * according to Angela voice styling guidelines.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  loadConfig,
  applyMacros,
  applyConversationalRealism,
  toSSML,
  extractTextFromSSML,
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
  output: z.enum(['ssml', 'text']).default('text'),
  preset: z.string().default('angela'),
  processingMode: z.enum(['angela_v2']).optional().default('angela_v2'), // V2 SSML processing only
});



/**
 * Response interface for V2 SSML processing
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
    conversational: string;
    withMacros: string;
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

    // Angela V2 SSML Processing - Only supported mode
    console.log('🎙️ Using Angela V2 SSML Processing Mode');
    return await processAngelaV2Mode(text, config, output);

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
    description: 'Processes raw text through Angela V2 SSML pipeline for cloned voice compatibility',
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
 * Angela V2 SSML Processing Mode - Clean pipeline for v2 with SSML emotional delivery
 * Applies Angela's voice rules with SSML tags for cloned voice compatibility
 */
async function processAngelaV2Mode(text: string, config: VoiceConfig, output: string) {
  try {
    console.log('🎙️ Angela V2 SSML Pipeline - Processing with SSML emotional delivery');
    console.log('📝 Input text:', text.substring(0, 100) + '...');
    
    // Check if input is already SSML (user edited the annotated script)
    const isAlreadySSML = text.trim().startsWith('<speak>') && text.trim().endsWith('</speak>');
    
    let ssmlText: string;
    let conversationalText: string;
    let macroText: string;
    
    if (isAlreadySSML) {
      console.log('🔄 Input is already SSML - using as-is for regeneration');
      ssmlText = text;
      conversationalText = text; // Will be overridden in response
      macroText = text; // Will be overridden in response
    } else {
      // Step 1: Apply Angela's conversational style
      console.log('🗣️ Step 1: Applying Angela\'s conversational characteristics');
      conversationalText = applyConversationalRealism(text, config);
      console.log('✅ After conversational style:', conversationalText.substring(0, 100) + '...');
      
      // Step 2: Apply macros (pause and emphasis markers)
      console.log('🔧 Step 2: Applying pause and emphasis macros');
      macroText = applyMacros(conversationalText, config);
      console.log('✅ After macros:', macroText.substring(0, 100) + '...');
      
      // Step 3: Convert to SSML for v2 emotional delivery
      console.log('🎙️ Step 3: Converting to SSML for v2 emotional delivery');
      ssmlText = toSSML(macroText, config);
      console.log('✅ After SSML conversion:', ssmlText.substring(0, 100) + '...');
    }
    
    // Step 4: Create chunks for synthesis
    console.log('✂️ Step 4: Creating chunks for v2 synthesis');
    const chunks = chunk(ssmlText, config);
    console.log(`📦 Created ${chunks.length} chunks (avg: ${Math.round(ssmlText.length / chunks.length)} chars each)`);
    
    // Generate manifest
    const manifestId = await saveManifest(chunks, {
      report: {
        warnings: [],
        bans: [],
        stats: {
          words: ssmlText.split(' ').length,
          sentences: ssmlText.split(/[.!?]+/).length - 1,
          groupAddressRatio: 0,
          consecutiveGroupAddress: 0
        }
      },
      configVersion: 'angela_v2_ssml',
      originalText: text,
    });

    const stats = {
      words: ssmlText.split(' ').length,
      sentences: ssmlText.split(/[.!?]+/).length - 1,
      chunks: chunks.length,
      ssmlTags: (ssmlText.match(/<[^>]+>/g) || []).length
    };

    console.log('✅ V2 SSML Processing Complete:', stats);

    return NextResponse.json({
      manifestId,
      chunks,
      report: {
        warnings: [],
        bans: [],
        stats
      },
      processing: {
        originalText: text,
        conversational: isAlreadySSML ? text : conversationalText,
        withMacros: isAlreadySSML ? text : macroText,
        finalOutput: ssmlText, // Always show SSML annotations for user editing
        pipeline: isAlreadySSML ? [
          { step: 'ssml_reuse', description: 'Reused existing SSML from user edits' },
          { step: 'chunking', description: 'Split into synthesis chunks' }
        ] : [
          { step: 'conversational', description: 'Applied Angela\'s conversational style' },
          { step: 'macros', description: 'Added pause and emphasis macros' },
          { step: 'ssml', description: 'Converted to SSML for v2 emotional delivery' },
          { step: 'chunking', description: 'Split into synthesis chunks' }
        ]
      }
    });

  } catch (error) {
    console.error('Error in Angela V2 processing:', error);
    return NextResponse.json(
      { error: `Angela V2 processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
