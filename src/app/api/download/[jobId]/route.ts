/**
 * API route for audio file downloads
 * Handles serving and redirecting to stored audio files
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAudioMetadata } from '@/lib/store';

interface RouteParams {
  params: Promise<{
    jobId: string;
  }>;
}

/**
 * GET /api/download/[jobId]
 * Serves or redirects to the audio file for download
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Retrieve audio metadata
    const audioMetadata = await getAudioMetadata(jobId);
    
    if (!audioMetadata) {
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      );
    }

    // Check if the file still exists and is accessible
    try {
      const response = await fetch(audioMetadata.audioUrl, { method: 'HEAD' });
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Audio file no longer available' },
          { status: 410 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Audio file no longer available' },
        { status: 410 }
      );
    }

    // Get query parameters
    const url = new URL(req.url);
    const download = url.searchParams.get('download') === '1';
    const inline = url.searchParams.get('inline') === '1';

    // Determine the appropriate URL to redirect to
    let redirectUrl = audioMetadata.audioUrl;
    
    if (download && audioMetadata.downloadUrl) {
      redirectUrl = audioMetadata.downloadUrl;
    } else if (audioMetadata.publicUrl) {
      redirectUrl = audioMetadata.publicUrl;
    }

    // Add download parameter if requested
    if (download && !redirectUrl.includes('download=')) {
      const separator = redirectUrl.includes('?') ? '&' : '?';
      redirectUrl += `${separator}download=1`;
    }

    // Set appropriate headers
    const headers = new Headers();
    
    if (download) {
      const filename = `white-soul-tarot-${jobId}.${audioMetadata.format}`;
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    } else if (inline) {
      headers.set('Content-Disposition', 'inline');
    }

    // Set content type
    const contentType = audioMetadata.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    headers.set('Content-Type', contentType);

    // Add cache headers
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Redirect to the blob storage URL
    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers,
    });

  } catch (error) {
    console.error('Error in /api/download/[jobId]:', error);

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
 * HEAD /api/download/[jobId]
 * Returns metadata about the audio file without downloading it
 */
export async function HEAD(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return new NextResponse(null, { status: 400 });
    }

    // Retrieve audio metadata
    const audioMetadata = await getAudioMetadata(jobId);
    
    if (!audioMetadata) {
      return new NextResponse(null, { status: 404 });
    }

    // Set headers with file information
    const headers = new Headers();
    const contentType = audioMetadata.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', audioMetadata.sizeBytes.toString());
    headers.set('Last-Modified', audioMetadata.createdAt.toUTCString());
    headers.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(null, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error in HEAD /api/download/[jobId]:', error);
    return new NextResponse(null, { status: 500 });
  }
}
