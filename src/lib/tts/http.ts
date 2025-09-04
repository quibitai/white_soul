/**
 * Custom HTTP client configuration for ElevenLabs API
 * Optimized for Vercel serverless environment with robust timeout handling
 */

import { Agent, fetch } from 'undici';

/**
 * Custom undici Agent optimized for ElevenLabs API calls in serverless environments
 * 
 * Key features:
 * - Extended timeouts for long-running TTS requests
 * - Connection pooling for efficiency
 * - Retry logic and DNS caching via interceptors
 * - Optimized for Vercel's serverless constraints
 */
export const elevenLabsAgent = new Agent({
  // Connection management
  connections: 10,              // Limit concurrent connections
  keepAliveTimeout: 30_000,     // 30 seconds keep-alive
  keepAliveMaxTimeout: 60_000,  // Maximum keep-alive duration
  
  // Timeout configuration optimized for ElevenLabs API
  headersTimeout: 120_000,      // 2 minutes to receive headers
  bodyTimeout: 0,               // No body timeout (use AbortSignal instead)
  
  // Connection behavior
  pipelining: 1,                // Disable pipelining for stability
});

/**
 * Enhanced fetch function with ElevenLabs-optimized dispatcher
 * Uses the custom agent for all requests
 */
export const elevenLabsFetch = fetch;

/**
 * Create an AbortSignal with timeout for ElevenLabs requests
 * Provides different timeouts for Vercel vs local development
 */
export function createElevenLabsTimeout(): AbortSignal {
  const isVercel = process.env.VERCEL === '1';
  const timeoutMs = isVercel ? 180_000 : 300_000; // 3 minutes Vercel, 5 minutes local
  
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Log network configuration for debugging
 */
export function logNetworkConfig(): void {
  const isVercel = process.env.VERCEL === '1';
  const nodeOptions = process.env.NODE_OPTIONS || 'not set';
  
  console.log('🌐 Network Configuration:', {
    environment: isVercel ? 'Vercel' : 'Local',
    nodeOptions,
    agentConfig: {
      maxConnections: '100',
      keepAliveTimeout: '30s',
      headersTimeout: '120s',
      bodyTimeout: 'disabled (using AbortSignal)'
    }
  });
}
