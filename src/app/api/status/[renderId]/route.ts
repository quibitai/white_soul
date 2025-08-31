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
  { params }: { params: { renderId: string } }
): Promise<NextResponse> {
  try {
    const { renderId } = params;

    if (!renderId) {
      return NextResponse.json(
        { error: 'Render ID is required' },
        { status: 400 }
      );
    }

    // Get status from blob storage
    const statusPath = generateRenderPath(renderId, 'status.json');
    
    try {
      const statusUrl = generateBlobUrl(statusPath);
      const response = await fetch(statusUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const status = await response.json();

      // If render is complete, also try to get diagnostics
      let diagnostics = null;
      let finalUrl = null;

      if (status.state === 'done') {
        try {
          const diagnosticsPath = generateRenderPath(renderId, 'diagnostics.json');
          const diagnosticsUrl = generateBlobUrl(diagnosticsPath);
          const diagnosticsResponse = await fetch(diagnosticsUrl);
          if (diagnosticsResponse.ok) {
            diagnostics = await diagnosticsResponse.json();
          }
        } catch (error) {
          console.warn('Could not load diagnostics:', error);
        }

        // Try to get final audio URL
        try {
          const requestPath = generateRenderPath(renderId, 'request.json');
          const requestUrl = generateBlobUrl(requestPath);
          const requestResponse = await fetch(requestUrl);
          if (requestResponse.ok) {
            const request = await requestResponse.json();
            const format = request.settings?.export?.format || 'mp3';
            
            const finalPath = generateRenderPath(renderId, `final.${format}`);
            // For now, construct the URL - in production this would be the actual blob URL
            finalUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/download/${renderId}`;
          }
        } catch (error) {
          console.warn('Could not determine final URL:', error);
        }
      }

      return NextResponse.json({
        ...status,
        diagnostics,
        finalUrl,
      });

    } catch (error) {
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
