/**
 * Environment variable checker endpoint
 * Helps diagnose missing configuration in Vercel deployment
 */

import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  const envCheck = {
    elevenlabs: {
      apiKey: !!process.env.ELEVENLABS_API_KEY,
      voiceId: !!process.env.ELEVEN_VOICE_ID,
      modelId: process.env.ELEVEN_MODEL_ID || 'eleven_multilingual_v2',
      bypassMode: process.env.BYPASS_ELEVENLABS === 'true',
    },
    vercel: {
      url: process.env.VERCEL_URL || 'not set',
      env: process.env.VERCEL_ENV || 'not set',
      region: process.env.VERCEL_REGION || 'not set',
    },
    app: {
      maxInputChars: process.env.MAX_INPUT_CHARS || '20000',
      audioRetentionDays: process.env.AUDIO_RETENTION_DAYS || '14',
    },
    deployment: {
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
    },
  };

  // Determine if configuration is complete
  const isConfigured = envCheck.elevenlabs.apiKey && envCheck.elevenlabs.voiceId;
  
  return NextResponse.json({
    configured: isConfigured,
    environment: envCheck,
    message: isConfigured 
      ? 'All required environment variables are set' 
      : 'Missing required environment variables',
    required: {
      ELEVENLABS_API_KEY: 'Your ElevenLabs API key',
      ELEVEN_VOICE_ID: 'Your Angela voice ID from ElevenLabs',
    },
    optional: {
      ELEVEN_MODEL_ID: 'ElevenLabs model (defaults to eleven_multilingual_v2)',
      BYPASS_ELEVENLABS: 'Set to "true" for testing without API calls',
      MAX_INPUT_CHARS: 'Maximum input characters (defaults to 20000)',
      AUDIO_RETENTION_DAYS: 'Audio file retention period (defaults to 14)',
    },
  });
}
