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
      chunking: {
        maxSec: 35,
        overlapMs: 500,
        contextSentences: 2
      },
      chunks: [
        {
          ix: 0,
          text: 'Hello world test',
          ssml: '<speak>Hello world test</speak>',
          hash: 'test-chunk-hash',
          blob: 'test-blob-key'
        }
      ]
    };
    
    const testSettings = {
      eleven: {
        stability: 0.5,
        similarityBoost: 0.5,
        style: 0.0,
        speakerBoost: true
      },
      ssml: {
        tagDensityMaxPer10Words: 2,
        breakMs: {
          comma: 200,
          clause: 300,
          sentence: 500,
          paragraph: 800
        },
        defaultRate: 1.0,
        defaultPitchSt: 0,
        enableIntimateBlock: false
      },
      chunking: {
        maxSec: 35,
        overlapMs: 500,
        contextSentences: 2
      },
      stitching: {
        crossfadeMs: 100,
        sampleRate: 44100 as const,
        mono: false
      },
      mastering: {
        enable: true,
        highpassHz: 80,
        deesserHz: 6000,
        deesserAmount: 0.3,
        compressor: {
          ratio: 3,
          attackMs: 10,
          releaseMs: 100,
          gainDb: 0
        },
        loudness: {
          targetLUFS: -14,
          truePeakDb: -1.0
        }
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
