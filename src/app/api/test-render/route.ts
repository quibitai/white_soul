/**
 * Test endpoint to verify processRender function works
 */

import { NextResponse } from 'next/server';

export async function POST() {
  console.log('🧪 Testing processRender function...');
  
  try {
    // Test dynamic import
    console.log('🔄 Testing dynamic import...');
    const { processRender } = await import('@/lib/workers/processRender');
    console.log('✅ Dynamic import successful');
    
    // Create minimal test data
    const testRenderId = 'test-render-123';
    const testManifest = {
      scriptHash: 'test-hash',
      settingsHash: 'test-settings-hash',
      chunks: [
        {
          ix: 0,
          hash: 'test-chunk-hash',
          text: 'Hello world test',
          ssml: '<speak>Hello world test</speak>',
          estSeconds: 2.0
        }
      ],
      metadata: {
        totalChunks: 1,
        totalDuration: 2.0,
        avgChunkSize: 15
      }
    };
    
    const testSettings = {
      eleven: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      },
      stitching: {
        crossfadeMs: 100,
        sampleRate: 44100,
        mono: false
      },
      mastering: {
        normalize: true,
        compressor: true,
        limiter: true
      },
      export: {
        format: 'mp3' as const,
        bitrateKbps: 128
      }
    };
    
    console.log('🚀 Calling processRender with test data...');
    
    // Set bypass mode for testing
    process.env.BYPASS_ELEVENLABS = 'true';
    
    const result = await processRender(testRenderId, testManifest, testSettings);
    
    console.log('✅ processRender completed successfully:', result);
    
    return NextResponse.json({
      success: true,
      message: 'processRender function test successful',
      result
    });
    
  } catch (error) {
    console.error('❌ processRender test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'processRender test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test-render',
    description: 'Test endpoint to verify processRender function works',
    usage: 'POST to this endpoint to test processRender with bypass mode'
  });
}
