/**
 * Hashing utilities for content-addressable caching
 * Provides deterministic hashing for scripts, settings, and chunks
 */

import { createHash } from 'crypto';
import { TuningSettings } from '@/lib/types/tuning';

/**
 * Generate SHA-256 hash of a string
 * @param content - Content to hash
 * @returns Hex-encoded hash string
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Generate hash for normalized script text
 * @param text - Normalized script text
 * @returns Script hash for cache key generation
 */
export function generateScriptHash(text: string): string {
  // Normalize whitespace and line endings for consistent hashing
  const normalized = text.trim().replace(/\s+/g, ' ').replace(/\r\n/g, '\n');
  return sha256(normalized);
}

/**
 * Generate hash for tuning settings
 * @param settings - TuningSettings object
 * @returns Settings hash for cache key generation
 */
export function generateSettingsHash(settings: TuningSettings): string {
  // Create deterministic JSON string (sorted keys)
  const sortedSettings = JSON.stringify(settings, Object.keys(settings).sort());
  return sha256(sortedSettings);
}

/**
 * Generate hash for individual chunk content + settings
 * @param ssmlContent - SSML content of the chunk
 * @param elevenSettings - ElevenLabs-specific settings
 * @returns Chunk hash for content-addressable storage
 */
export function generateChunkHash(
  ssmlContent: string,
  elevenSettings: TuningSettings['eleven']
): string {
  const combined = JSON.stringify({
    ssml: ssmlContent.trim(),
    settings: elevenSettings,
  });
  return sha256(combined);
}

/**
 * Generate render ID using nanoid-compatible format
 * @returns Unique render ID
 */
export function generateRenderId(): string {
  // Use crypto.randomBytes for secure random ID generation
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate hash format (64-character hex string)
 * @param hash - Hash string to validate
 * @returns True if valid SHA-256 hash format
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Generate cache key for chunk storage
 * @param chunkHash - Hash of chunk content + settings
 * @returns Blob storage path for cached chunk
 */
export function generateChunkCacheKey(chunkHash: string): string {
  return `tts/cache/chunks/${chunkHash}.wav`;
}

/**
 * Generate blob path for render artifacts
 * @param renderId - Unique render identifier
 * @param artifact - Type of artifact (request.json, status.json, etc.)
 * @returns Blob storage path for render artifact
 */
export function generateRenderPath(renderId: string, artifact: string): string {
  return `tts/renders/${renderId}/${artifact}`;
}

/**
 * Generate blob path for chunk in render
 * @param renderId - Unique render identifier
 * @param chunkIndex - Index of chunk in sequence
 * @param chunkHash - Hash of chunk content
 * @returns Blob storage path for render chunk
 */
export function generateRenderChunkPath(
  renderId: string,
  chunkIndex: number,
  chunkHash: string
): string {
  return `tts/renders/${renderId}/chunks/${chunkIndex}-${chunkHash}.wav`;
}

/**
 * Generate full blob URL for fetching
 * @param blobPath - Blob storage path
 * @returns Full URL for fetching the blob
 */
export function generateBlobUrl(blobPath: string): string {
  // In development, this would be a local URL
  // In production, this would be the Vercel Blob URL
  const baseUrl = process.env.BLOB_READ_WRITE_TOKEN 
    ? 'https://blob.vercel-storage.com' 
    : 'http://localhost:3000/api/blob';
  
  return `${baseUrl}/${blobPath}`;
}
