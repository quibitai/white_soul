/**
 * Manifest storage for White Soul Tarot TTS processing
 * Manages storage and retrieval of text processing manifests and metadata
 */

import { v4 as uuidv4 } from 'uuid';
import { TextChunk, LintReport } from '../styling';

export interface ProcessingManifest {
  id: string;
  chunks: TextChunk[];
  report: LintReport;
  metadata: {
    configVersion: string;
    createdAt: Date;
    originalText: string;
    totalDuration: number;
    totalChars: number;
  };
}

export interface StoredAudio {
  manifestId: string;
  audioUrl: string;
  downloadUrl?: string;
  publicUrl?: string;
  format: string;
  sizeBytes: number;
  createdAt: Date;
}

// In-memory storage for development (replace with persistent storage in production)
const manifestStore = new Map<string, ProcessingManifest>();
const audioStore = new Map<string, StoredAudio>();

/**
 * Saves a processing manifest with chunks and report
 * @param {TextChunk[]} chunks - Processed text chunks
 * @param {object} options - Additional options including report and metadata
 * @returns {Promise<string>} Manifest ID
 */
export async function saveManifest(
  chunks: TextChunk[],
  options: {
    report: LintReport;
    configVersion: string;
    originalText?: string;
  }
): Promise<string> {
  const manifestId = uuidv4();
  
  const totalDuration = chunks.reduce((sum, chunk) => sum + chunk.estSeconds, 0);
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.charCount, 0);

  const manifest: ProcessingManifest = {
    id: manifestId,
    chunks,
    report: options.report,
    metadata: {
      configVersion: options.configVersion,
      createdAt: new Date(),
      originalText: options.originalText || '',
      totalDuration,
      totalChars,
    },
  };

  manifestStore.set(manifestId, manifest);
  
  return manifestId;
}

/**
 * Retrieves a processing manifest by ID
 * @param {string} manifestId - Manifest ID to retrieve
 * @returns {Promise<ProcessingManifest | null>} Manifest or null if not found
 */
export async function getManifest(manifestId: string): Promise<ProcessingManifest | null> {
  return manifestStore.get(manifestId) || null;
}

/**
 * Stores audio file metadata and URLs
 * @param {string} manifestId - Associated manifest ID
 * @param {object} audioData - Audio file data and metadata
 * @returns {Promise<StoredAudio>} Stored audio metadata
 */
export async function saveAudioMetadata(
  manifestId: string,
  audioData: {
    audioUrl: string;
    downloadUrl?: string;
    publicUrl?: string;
    format: string;
    sizeBytes: number;
  }
): Promise<StoredAudio> {
  const storedAudio: StoredAudio = {
    manifestId,
    ...audioData,
    createdAt: new Date(),
  };

  audioStore.set(manifestId, storedAudio);
  
  return storedAudio;
}

/**
 * Retrieves audio metadata by manifest ID
 * @param {string} manifestId - Manifest ID
 * @returns {Promise<StoredAudio | null>} Audio metadata or null if not found
 */
export async function getAudioMetadata(manifestId: string): Promise<StoredAudio | null> {
  return audioStore.get(manifestId) || null;
}

/**
 * Lists recent manifests with optional filtering
 * @param {object} options - Filtering and pagination options
 * @returns {Promise<ProcessingManifest[]>} Array of manifests
 */
export async function listManifests(options: {
  limit?: number;
  offset?: number;
  since?: Date;
} = {}): Promise<ProcessingManifest[]> {
  const { limit = 10, offset = 0, since } = options;
  
  let manifests = Array.from(manifestStore.values());
  
  // Filter by date if specified
  if (since) {
    manifests = manifests.filter(m => m.metadata.createdAt >= since);
  }
  
  // Sort by creation date (newest first)
  manifests.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime());
  
  // Apply pagination
  return manifests.slice(offset, offset + limit);
}

/**
 * Deletes a manifest and associated audio metadata
 * @param {string} manifestId - Manifest ID to delete
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteManifest(manifestId: string): Promise<boolean> {
  const manifestDeleted = manifestStore.delete(manifestId);
  const audioDeleted = audioStore.delete(manifestId);
  
  return manifestDeleted || audioDeleted;
}

/**
 * Cleans up old manifests based on retention policy
 * @param {number} retentionDays - Number of days to retain manifests
 * @returns {Promise<number>} Number of manifests deleted
 */
export async function cleanupOldManifests(retentionDays: number = 14): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  let deletedCount = 0;
  
  for (const [id, manifest] of manifestStore.entries()) {
    if (manifest.metadata.createdAt < cutoffDate) {
      manifestStore.delete(id);
      audioStore.delete(id);
      deletedCount++;
    }
  }
  
  return deletedCount;
}

/**
 * Gets storage statistics
 * @returns {Promise<object>} Storage statistics
 */
export async function getStorageStats(): Promise<{
  totalManifests: number;
  totalAudioFiles: number;
  oldestManifest?: Date;
  newestManifest?: Date;
}> {
  const manifests = Array.from(manifestStore.values());
  const audioFiles = Array.from(audioStore.values());
  
  const dates = manifests.map(m => m.metadata.createdAt);
  
  return {
    totalManifests: manifests.length,
    totalAudioFiles: audioFiles.length,
    oldestManifest: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined,
    newestManifest: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined,
  };
}

/**
 * Clears all stored data (useful for testing)
 */
export function clearAllData(): void {
  manifestStore.clear();
  audioStore.clear();
}
