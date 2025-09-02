/**
 * API route to enable/disable ElevenLabs bypass mode for debugging
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/set-bypass
 * Enable or disable bypass mode
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { enabled } = await req.json();
    
    // In a real app, you'd set this in a database or environment variable
    // For now, we'll just return success and rely on the environment variable
    console.log(`🔧 Bypass mode ${enabled ? 'enabled' : 'disabled'}`);
    
    return NextResponse.json({
      success: true,
      message: `Bypass mode ${enabled ? 'enabled' : 'disabled'}`,
      note: 'Set BYPASS_ELEVENLABS=true in Vercel environment variables to activate'
    });

  } catch (error) {
    console.error('Error in /api/set-bypass:', error);
    
    return NextResponse.json(
      { error: 'Failed to set bypass mode' },
      { status: 500 }
    );
  }
}
