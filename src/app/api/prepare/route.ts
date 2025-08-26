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
  toSSML,
  chunk,
  type TextChunk,
  type LintReport,
} from '@/lib/styling';
import { saveManifest } from '@/lib/store';

/**
 * Request schema validation
 */
const PrepareRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  output: z.enum(['ssml', 'text']).default('ssml'),
  preset: z.string().default('angela'),
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
}

/**
 * POST /api/prepare
 * Processes raw text through the complete styling pipeline
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await req.json();
    const { text, output } = PrepareRequestSchema.parse(body);

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

    // Process text through styling pipeline
    const normalized = normalize(text, config);
    const report = lint(normalized, config);
    const withMacros = applyMacros(normalized, config);
    const conversational = applyConversationalRealism(withMacros, config);
    const wst2Formatted = applyWST2Rules(conversational, config);
    const chunks = chunk(wst2Formatted, config);

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

    // Prepare response
    const response: PrepareResponse = {
      manifestId,
      chunks: processedChunks.map(chunk => ({
        id: chunk.id,
        body: chunk.body,
        estSeconds: chunk.estSeconds,
      })),
      report,
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
