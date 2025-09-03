/**
 * Simple test endpoint to verify ElevenLabs API connectivity
 */

import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🧪 Testing ElevenLabs API connectivity...');
    
    // Check environment variables
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVEN_VOICE_ID;
    
    console.log('Environment check:', {
      hasApiKey: !!apiKey,
      hasVoiceId: !!voiceId,
      voiceIdPreview: voiceId ? `${voiceId.slice(0, 8)}...` : 'MISSING'
    });
    
    if (!apiKey || !voiceId) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        details: {
          hasApiKey: !!apiKey,
          hasVoiceId: !!voiceId
        }
      }, { status: 500 });
    }
    
    // Simple test with minimal SSML
    const testSSML = '<speak>Hello world</speak>';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    console.log('🌐 Making test request to ElevenLabs...');
    console.log('URL:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ Test request timeout (10s)');
      controller.abort();
    }, 10000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: testSSML,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return NextResponse.json({
        success: false,
        error: `ElevenLabs API error: ${response.status}`,
        details: errorText
      }, { status: 500 });
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const audioSize = arrayBuffer.byteLength;
    
    console.log('✅ Test successful! Audio size:', audioSize, 'bytes');
    
    return NextResponse.json({
      success: true,
      message: 'ElevenLabs API test successful',
      audioSize,
      voiceId: voiceId.slice(0, 8) + '...'
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        error: 'Request timeout - ElevenLabs API took too long to respond'
      }, { status: 408 });
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
