/**
 * API route to process render jobs
 * Handles the synthesis, stitching, and mastering pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processRender } from '@/lib/workers/processRender';

/**
 * Request schema for process endpoint
 */
const ProcessRequestSchema = z.object({
  renderId: z.string().min(1, 'Render ID is required'),
});

/**
 * POST /api/process
 * Process a queued render job
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { renderId } = ProcessRequestSchema.parse(body);

    console.log(`🚀 Processing render ${renderId}`);

    // Process the render
    const result = await processRender(renderId);

    return NextResponse.json({
      success: true,
      renderId,
      finalKey: result.finalKey,
      message: 'Render processed successfully',
    });

  } catch (error) {
    console.error('Error in /api/process:', error);

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
 * GET /api/process
 * Returns API documentation
 */
export async function GET(): Promise<NextResponse> {
  const documentation = {
    endpoint: '/api/process',
    method: 'POST',
    description: 'Process a queued render job through synthesis, stitching, and mastering',
    parameters: {
      renderId: {
        type: 'string',
        required: true,
        description: 'Unique render identifier from startRender action',
      },
    },
    response: {
      success: 'boolean - Whether processing succeeded',
      renderId: 'string - The processed render ID',
      finalKey: 'string - Blob storage key for final audio',
      message: 'string - Success message',
    },
    workflow: [
      '1. Load manifest and settings from blob storage',
      '2. Synthesize chunks with caching (check cache first)',
      '3. Stitch chunks with crossfade transitions',
      '4. Apply mastering (EQ, compression, loudness)',
      '5. Generate diagnostics and analysis',
      '6. Update status to completed',
    ],
    example: {
      request: {
        renderId: 'abc123def456',
      },
      response: {
        success: true,
        renderId: 'abc123def456',
        finalKey: 'tts/renders/abc123def456/final.mp3',
        message: 'Render processed successfully',
      },
    },
  };

  return NextResponse.json(documentation);
}
