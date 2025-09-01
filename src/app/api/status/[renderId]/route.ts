/**
 * API route to get render status
 * Returns current status and progress for a render job
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRenderPath, generateBlobUrl } from '@/lib/utils/hash';

/**
 * GET /api/status/[renderId]
 * Get current status of a render job
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ renderId: string }> }
): Promise<NextResponse> {
  try {
    const { renderId } = await params;

    if (!renderId) {
      return NextResponse.json(
        { error: 'Render ID is required' },
        { status: 400 }
      );
    }

    // Get status from blob storage
    const statusUrl = generateBlobUrl(generateRenderPath(renderId, 'status.json'));
    
    try {
      const response = await fetch(statusUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const status = await response.json();

      // If render is complete, also try to get diagnostics, finalUrl, and SSML
      let diagnostics = null;
      let finalUrl = null;
      let ssmlContent = null;

      if (status.state === 'done') {
        try {
          const diagnosticsUrl = generateBlobUrl(generateRenderPath(renderId, 'diagnostics.json'));
          const diagnosticsResponse = await fetch(diagnosticsUrl);
          if (diagnosticsResponse.ok) {
            diagnostics = await diagnosticsResponse.json();
          }
        } catch {
          console.warn('Could not load diagnostics');
        }

        // Try to get final audio URL
        try {
          const requestUrl = generateBlobUrl(generateRenderPath(renderId, 'request.json'));
          const requestResponse = await fetch(requestUrl);
          if (requestResponse.ok) {
            const request = await requestResponse.json();
            const format = request.settings?.export?.format || 'mp3';
            
            // Return direct blob URL for the final audio file
            finalUrl = generateBlobUrl(generateRenderPath(renderId, `final.${format}`));
          }
        } catch {
          console.warn('Could not determine final URL');
        }

        // Try to get SSML content
        try {
          const ssmlUrl = generateBlobUrl(generateRenderPath(renderId, 'ssml.xml'));
          const ssmlResponse = await fetch(ssmlUrl);
          if (ssmlResponse.ok) {
            ssmlContent = await ssmlResponse.text();
          }
        } catch {
          console.warn('Could not load SSML content');
        }
      }

      return NextResponse.json({
        ...status,
        diagnostics,
        finalUrl,
        ssmlContent,
      });

    } catch {
      // Status not found - render might not exist
      return NextResponse.json(
        { error: 'Render not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Error in /api/status:', error);

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
