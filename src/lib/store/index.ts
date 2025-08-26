/**
 * Storage library exports for White Soul Tarot
 */

// Manifest storage
export {
  saveManifest,
  getManifest,
  saveAudioMetadata,
  getAudioMetadata,
  listManifests,
  deleteManifest,
  cleanupOldManifests,
  getStorageStats,
  clearAllData,
  type ProcessingManifest,
  type StoredAudio,
} from './manifest';

// Blob storage
export {
  putAudio,
  deleteAudio,
  getAudioMetadata as getBlobMetadata,
  generateAudioFilename,
  isBlobStorageAvailable,
  cleanupOldAudioFiles,
  type BlobStorageResult,
} from './blob';
