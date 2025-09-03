/**
 * Simple test endpoint to verify /api/process functionality
 */

import { NextResponse } from 'next/server';

export async function POST() {
  console.log('🧪 TEST: /api/test-process called');
  
  try {
    // Test making a call to our own /api/process endpoint
    const testRenderId = 'test-render-id-123';
    
    console.log('🔗 Testing internal API call to /api/process');
    
    const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        renderId: testRenderId,
        manifest: { test: true },
        settings: { test: true }
      }),
    });
    
    console.log(`📡 Internal API response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Internal API call failed:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Internal API call failed',
        details: errorText,
        status: response.status
      });
    }
    
    const result = await response.json();
    console.log('✅ Internal API call successful:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Internal API call test successful',
      result
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test-process',
    description: 'Test endpoint to verify /api/process functionality',
    usage: 'POST to this endpoint to test internal API calls'
  });
}
