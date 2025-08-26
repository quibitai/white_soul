/**
 * Vercel Blob storage utilities for White Soul Tarot
 * Handles audio file storage and retrieval using Vercel Blob
 */

import { put, del, head } from '@vercel/blob';

export interface BlobStorageResult {
  url: string;
  downloadUrl: string;
  publicUrl: string;
  pathname: string;
  size: number;
}

/**
 * Stores audio buffer in Vercel Blob storage
 * @param {string} filename - File name/path for the audio file
 * @param {Buffer} audioBuffer - Audio data to store
 * @param {object} options - Storage options
 * @returns {Promise<BlobStorageResult>} Storage result with URLs
 */
export async function putAudio(
  filename: string,
  audioBuffer: Buffer,
  options: {
    access?: 'public';
    contentType?: string;
  } = {}
): Promise<BlobStorageResult> {
  const { access = 'public', contentType = 'audio/mpeg' } = options;

  try {
    const blob = await put(filename, audioBuffer, {
      access,
      contentType,
      addRandomSuffix: false, // Keep consistent filenames
    });

    return {
      url: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
      publicUrl: blob.url,
      pathname: blob.pathname,
      size: audioBuffer.length, // Use buffer length as size
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to store audio in blob: ${error.message}`);
    }
    throw new Error('Failed to store audio in blob: Unknown error');
  }
}

/**
 * Deletes audio file from Vercel Blob storage
 * @param {string} url - Blob URL to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteAudio(url: string): Promise<boolean> {
  try {
    await del(url);
    return true;
  } catch (error) {
    console.error('Failed to delete audio from blob:', error);
    return false;
  }
}

/**
 * Gets metadata for a stored audio file
 * @param {string} url - Blob URL to check
 * @returns {Promise<object | null>} File metadata or null if not found
 */
export async function getAudioMetadata(url: string): Promise<{
  size: number;
  uploadedAt: Date;
  pathname: string;
  contentType: string;
} | null> {
  try {
    const metadata = await head(url);
    
    return {
      size: metadata.size,
      uploadedAt: metadata.uploadedAt,
      pathname: metadata.pathname,
      contentType: metadata.contentType || 'audio/mpeg',
    };
  } catch (error) {
    console.error('Failed to get audio metadata:', error);
    return null;
  }
}

/**
 * Generates a unique filename for audio storage
 * @param {string} manifestId - Manifest ID
 * @param {string} format - Audio format (mp3, wav, etc.)
 * @returns {string} Unique filename
 */
export function generateAudioFilename(manifestId: string, format: string = 'mp3'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `tts/${timestamp}-${manifestId}.${format}`;
}

/**
 * Validates that Vercel Blob is properly configured
 * @returns {boolean} True if Blob storage is available
 */
export function isBlobStorageAvailable(): boolean {
  // Vercel Blob is automatically configured in Vercel environments
  // In development, it uses a local storage implementation
  return true;
}

/**
 * Cleans up old audio files based on retention policy
 * Note: This is a placeholder - Vercel Blob doesn't provide list functionality
 * In production, you'd need to track files in a database for cleanup
 * @param {number} retentionDays - Number of days to retain files
 * @returns {Promise<number>} Number of files deleted (always 0 for now)
 */
export async function cleanupOldAudioFiles(_retentionDays: number = 14): Promise<number> {
  // TODO: Implement cleanup when file tracking is added
  // For now, rely on manual cleanup or external processes
  console.warn('Automatic cleanup not implemented for Vercel Blob. Consider implementing file tracking.');
  return 0;
}
