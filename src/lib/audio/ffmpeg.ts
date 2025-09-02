/**
 * FFmpeg audio processing utilities for dev_plan_02
 * Handles stitching, crossfading, mastering, and format conversion
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TuningSettings } from '@/lib/types/tuning';
import { getFFmpegPaths, logEnvironmentInfo } from '@/lib/config/vercel';

/**
 * Convert raw PCM data to WAV format with proper headers
 * @param pcmBuffer - Raw PCM audio data
 * @param sampleRate - Sample rate (default: 44100)
 * @param channels - Number of channels (default: 1 for mono)
 * @param bitsPerSample - Bits per sample (default: 16)
 * @returns WAV formatted buffer
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 44100,
  channels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  let offset = 0;

  // RIFF header
  header.write('RIFF', offset); offset += 4;
  header.writeUInt32LE(fileSize, offset); offset += 4;
  header.write('WAVE', offset); offset += 4;

  // fmt chunk
  header.write('fmt ', offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4; // chunk size
  header.writeUInt16LE(1, offset); offset += 2; // audio format (PCM)
  header.writeUInt16LE(channels, offset); offset += 2;
  header.writeUInt32LE(sampleRate, offset); offset += 4;
  header.writeUInt32LE(byteRate, offset); offset += 4;
  header.writeUInt16LE(blockAlign, offset); offset += 2;
  header.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  header.write('data', offset); offset += 4;
  header.writeUInt32LE(dataSize, offset);

  return Buffer.concat([header, pcmBuffer]);
}

// Initialize FFmpeg path with environment-aware handling
async function initFFmpeg() {
  try {
    // Log environment info for debugging
    logEnvironmentInfo();
    
    // Get prioritized paths for current environment
    const pathsToTry = getFFmpegPaths();
    
    // Add the static path if available
    if (ffmpegPath) {
      pathsToTry.unshift(ffmpegPath);
    }
    
    console.log('🔍 Searching for FFmpeg binary in paths:', pathsToTry);
    
    for (const path of pathsToTry) {
      try {
        await fs.access(path);
        console.log('✅ Found FFmpeg binary at:', path);
        ffmpeg.setFfmpegPath(path);
        return; // Success, exit early
      } catch {
        // Continue to next path
      }
    }
    
    // If no paths work, log the attempted paths and use system FFmpeg
    console.warn('⚠️ FFmpeg binary not found at any of these paths:', pathsToTry);
    console.log('🔄 Falling back to system FFmpeg (may cause issues in serverless)');
  } catch (error) {
    console.error('❌ Failed to initialize FFmpeg:', error);
  }
}

// Set FFmpeg path with better error handling and fallbacks
if (ffmpegPath) {
  console.log('Setting FFmpeg path to:', ffmpegPath);
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.warn('FFmpeg path not found, using system FFmpeg');
}

/**
 * Crossfade join multiple audio buffers with smooth transitions
 * @param audioBuffers - Array of audio buffers to join
 * @param crossfadeMs - Crossfade duration in milliseconds
 * @param sampleRate - Target sample rate (44100 or 22050)
 * @param mono - Whether to output mono audio
 * @returns Stitched audio buffer
 */
export async function acrossfadeJoin(
  audioBuffers: Buffer[],
  crossfadeMs: number = 120,
  sampleRate: number = 44100,
  mono: boolean = true
): Promise<Buffer> {
  // Initialize FFmpeg path if needed
  await initFFmpeg();
  
  if (audioBuffers.length === 0) {
    throw new Error('No audio buffers provided');
  }
  
  if (audioBuffers.length === 1) {
    // Single buffer, just return it (possibly resampled)
    return await resampleAudio(audioBuffers[0], sampleRate, mono);
  }
  
  const tempDir = tmpdir();
  const tempFiles: string[] = [];
  
  try {
    // Write buffers to temporary files (convert PCM to WAV format)
    for (let i = 0; i < audioBuffers.length; i++) {
      const tempFile = join(tempDir, `chunk_${i}_${Date.now()}.wav`);
      // Convert raw PCM data to proper WAV format with headers
      const wavBuffer = pcmToWav(audioBuffers[i], sampleRate, mono ? 1 : 2);
      await fs.writeFile(tempFile, wavBuffer);
      tempFiles.push(tempFile);
    }
    
    // Create output file path
    const outputFile = join(tempDir, `stitched_${Date.now()}.wav`);
    
    // Build FFmpeg filter complex for crossfading
    const filterComplex = buildCrossfadeFilter(audioBuffers.length, crossfadeMs / 1000);
    console.log(`🔧 FFmpeg filter: ${filterComplex}`);
    console.log(`🔧 Input files: ${tempFiles.length}`);
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      // Add all input files
      tempFiles.forEach(file => {
        command = command.input(file);
      });
      
      // Apply crossfade filter and output settings
      command
        .complexFilter(filterComplex)
        .map('[out]')
        .audioChannels(mono ? 1 : 2)
        .audioFrequency(sampleRate)
        .audioCodec('pcm_s16le')
        .format('wav')
        .output(outputFile)
        .on('end', async () => {
          try {
            const result = await fs.readFile(outputFile);
            
            // Cleanup temporary files after successful processing
            for (const file of [...tempFiles, outputFile]) {
              try {
                await fs.unlink(file);
              } catch (error) {
                console.warn(`Failed to cleanup temp file ${file}:`, error);
              }
            }
            
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', async (error: Error) => {
          console.error('FFmpeg crossfade error:', error);
          
          // Cleanup temporary files on error
          for (const file of [...tempFiles, outputFile]) {
            try {
              await fs.unlink(file);
            } catch (cleanupError) {
              console.warn(`Failed to cleanup temp file ${file}:`, cleanupError);
            }
          }
          
          reject(error);
        })
        .run();
    });
    
  } catch (error) {
    // Cleanup on synchronous errors
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch (cleanupError) {
        console.warn(`Failed to cleanup temp file ${file}:`, cleanupError);
      }
    }
    throw error;
  }
}

/**
 * Build FFmpeg filter complex for crossfading multiple audio files
 * @param fileCount - Number of input files
 * @param crossfadeDuration - Crossfade duration in seconds
 * @returns Filter complex string
 */
function buildCrossfadeFilter(fileCount: number, crossfadeDuration: number): string {
  if (fileCount === 1) {
    return '[0:a]anull[out]';
  }
  
  if (fileCount === 2) {
    return `[0:a][1:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[out]`;
  }
  
  // For multiple files, chain crossfades
  const filters: string[] = [];
  let currentLabel = '[0:a]';
  
  for (let i = 1; i < fileCount; i++) {
    const nextLabel = i === fileCount - 1 ? '[out]' : `[cf${i}]`;
    filters.push(`${currentLabel}[${i}:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri${nextLabel}`);
    currentLabel = `[cf${i}]`;
  }
  
  return filters.join(';');
}

/**
 * Resample audio to target format
 * @param audioBuffer - Input audio buffer
 * @param sampleRate - Target sample rate
 * @param mono - Whether to convert to mono
 * @returns Resampled audio buffer
 */
export async function resampleAudio(
  audioBuffer: Buffer,
  sampleRate: number = 44100,
  mono: boolean = true
): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputFile = join(tempDir, `input_${Date.now()}.wav`);
  const outputFile = join(tempDir, `output_${Date.now()}.wav`);
  
  try {
    // Write input buffer to file (convert PCM to WAV format)
    const wavBuffer = pcmToWav(audioBuffer, 44100, 1); // Assume input is mono PCM at 44.1kHz
    await fs.writeFile(inputFile, wavBuffer);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .audioChannels(mono ? 1 : 2)
        .audioFrequency(sampleRate)
        .audioCodec('pcm_s16le')
        .format('wav')
        .output(outputFile)
        .on('end', async () => {
          try {
            const result = await fs.readFile(outputFile);
            
            // Cleanup temporary files after successful processing
            try {
              await fs.unlink(inputFile);
              await fs.unlink(outputFile);
            } catch (error) {
              console.warn('Failed to cleanup temp files:', error);
            }
            
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', async (error: Error) => {
          // Cleanup temporary files on error
          try {
            await fs.unlink(inputFile);
            await fs.unlink(outputFile);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp files:', cleanupError);
          }
          reject(error);
        })
        .run();
    });
    
  } catch (error) {
    // Cleanup on synchronous errors
    try {
      await fs.unlink(inputFile);
      await fs.unlink(outputFile);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp files:', cleanupError);
    }
    throw error;
  }
}

/**
 * Master audio with compression, EQ, and loudness normalization
 * @param audioBuffer - Input audio buffer
 * @param settings - Mastering settings
 * @returns Mastered audio buffer
 */
export async function masterAndEncode(
  audioBuffer: Buffer,
  settings: TuningSettings['mastering'] & { format: 'wav' | 'mp3' | 'aac'; bitrateKbps?: number }
): Promise<Buffer> {
  if (!settings.enable) {
    // No mastering, just encode to target format
    return await encodeAudio(audioBuffer, settings.format, settings.bitrateKbps);
  }
  
  const tempDir = tmpdir();
  const inputFile = join(tempDir, `input_${Date.now()}.wav`);
  const outputFile = join(tempDir, `mastered_${Date.now()}.${settings.format}`);
  
  try {
    // Write input buffer to file (convert to WAV format if needed)
    // The input should already be a WAV buffer from stitching, but ensure proper format
    await fs.writeFile(inputFile, audioBuffer);
    
    // Build audio filter chain
    const filters = buildMasteringFilters(settings);
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputFile);
      
      // Apply mastering filters
      if (filters.length > 0) {
        command = command.audioFilters(filters);
      }
      
      // Set output format
      if (settings.format === 'mp3') {
        command = command
          .audioCodec('libmp3lame')
          .audioBitrate(settings.bitrateKbps || 224);
      } else if (settings.format === 'aac') {
        command = command
          .audioCodec('aac')
          .audioBitrate(settings.bitrateKbps || 128);
      } else {
        command = command
          .audioCodec('pcm_s16le');
      }
      
      command
        .format(settings.format)
        .output(outputFile)
        .on('end', async () => {
          try {
            const result = await fs.readFile(outputFile);
            
            // Cleanup temporary files after successful processing
            try {
              await fs.unlink(inputFile);
              await fs.unlink(outputFile);
            } catch (error) {
              console.warn('Failed to cleanup temp files:', error);
            }
            
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', async (error: Error) => {
          // Cleanup temporary files on error
          try {
            await fs.unlink(inputFile);
            await fs.unlink(outputFile);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp files:', cleanupError);
          }
          reject(error);
        })
        .run();
    });
    
  } catch (error) {
    // Cleanup on synchronous errors
    try {
      await fs.unlink(inputFile);
      await fs.unlink(outputFile);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp files:', cleanupError);
    }
    throw error;
  }
}

/**
 * Build mastering filter chain
 * @param settings - Mastering settings
 * @returns Array of FFmpeg audio filters
 */
function buildMasteringFilters(settings: TuningSettings['mastering']): string[] {
  const filters: string[] = [];
  
  // High-pass filter
  if (settings.highpassHz > 0) {
    filters.push(`highpass=f=${settings.highpassHz}`);
  }
  
  // De-esser (dynamic EQ at sibilant frequencies)
  if (settings.deesserHz > 0 && settings.deesserAmount > 0) {
    // Approximate de-essing with a gentle notch filter
    const q = 2.0; // Quality factor
    const gain = -settings.deesserAmount * 6; // Convert to dB reduction
    filters.push(`equalizer=f=${settings.deesserHz}:width_type=q:width=${q}:g=${gain}`);
  }
  
  // Compressor
  const comp = settings.compressor;
  if (comp.ratio > 1) {
    filters.push(
      `acompressor=ratio=${comp.ratio}:attack=${comp.attackMs}:release=${comp.releaseMs}:makeup=${comp.gainDb}`
    );
  }
  
  // Loudness normalization (two-pass)
  filters.push(
    `loudnorm=I=${settings.loudness.targetLUFS}:TP=${settings.loudness.truePeakDb}:LRA=7:print_format=summary`
  );
  
  return filters;
}

/**
 * Encode audio to target format without mastering
 * @param audioBuffer - Input audio buffer
 * @param format - Target format
 * @param bitrateKbps - Bitrate for compressed formats
 * @returns Encoded audio buffer
 */
export async function encodeAudio(
  audioBuffer: Buffer,
  format: 'wav' | 'mp3' | 'aac',
  bitrateKbps?: number
): Promise<Buffer> {
  if (format === 'wav') {
    // Already WAV, return as-is
    return audioBuffer;
  }
  
  const tempDir = tmpdir();
  const inputFile = join(tempDir, `input_${Date.now()}.wav`);
  const outputFile = join(tempDir, `encoded_${Date.now()}.${format}`);
  
  try {
    await fs.writeFile(inputFile, audioBuffer);
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputFile);
      
      if (format === 'mp3') {
        command = command
          .audioCodec('libmp3lame')
          .audioBitrate(bitrateKbps || 224);
      } else if (format === 'aac') {
        command = command
          .audioCodec('aac')
          .audioBitrate(bitrateKbps || 128);
      }
      
      command
        .format(format)
        .output(outputFile)
        .on('end', async () => {
          try {
            const result = await fs.readFile(outputFile);
            
            // Cleanup temporary files after successful processing
            try {
              await fs.unlink(inputFile);
              await fs.unlink(outputFile);
            } catch (error) {
              console.warn('Failed to cleanup temp files:', error);
            }
            
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', async (error: Error) => {
          // Cleanup temporary files on error
          try {
            await fs.unlink(inputFile);
            await fs.unlink(outputFile);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp files:', cleanupError);
          }
          reject(error);
        })
        .run();
    });
    
  } catch (error) {
    // Cleanup on synchronous errors
    try {
      await fs.unlink(inputFile);
      await fs.unlink(outputFile);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp files:', cleanupError);
    }
    throw error;
  }
}

/**
 * Analyze audio for diagnostics
 * @param audioBuffer - Audio buffer to analyze
 * @returns Audio analysis data
 */
export async function analyzeAudio(audioBuffer: Buffer): Promise<{
  durationSec: number;
  lufsIntegrated: number;
  truePeakDb: number;
  joinEnergySpikes: Array<{ posMs: number; db: number }>;
}> {
  const tempDir = tmpdir();
  const inputFile = join(tempDir, `analyze_${Date.now()}.wav`);
  
  try {
    await fs.writeFile(inputFile, audioBuffer);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .audioFilters([
          'astats=metadata=1:reset=1',
          'ebur128=metadata=1'
        ])
        .format('null')
        .output('-')
        .on('end', async () => {
          // TODO: Parse FFmpeg output for actual measurements
          // For now, return placeholder values
          
          // Cleanup temporary file after successful processing
          try {
            await fs.unlink(inputFile);
          } catch (error) {
            console.warn('Failed to cleanup analysis temp file:', error);
          }
          
          resolve({
            durationSec: audioBuffer.length / (44100 * 2 * 2), // Rough estimate
            lufsIntegrated: -14.0, // Placeholder
            truePeakDb: -1.0, // Placeholder
            joinEnergySpikes: [], // TODO: Implement spike detection
          });
        })
        .on('error', async (error: Error) => {
          // Cleanup temporary file on error
          try {
            await fs.unlink(inputFile);
          } catch (cleanupError) {
            console.warn('Failed to cleanup analysis temp file:', cleanupError);
          }
          reject(error);
        })
        .run();
    });
    
  } catch (error) {
    // Cleanup on synchronous errors
    try {
      await fs.unlink(inputFile);
    } catch (cleanupError) {
      console.warn('Failed to cleanup analysis temp file:', cleanupError);
    }
    throw error;
  }
}
