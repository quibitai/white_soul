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

// Set FFmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
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
    // Write buffers to temporary files
    for (let i = 0; i < audioBuffers.length; i++) {
      const tempFile = join(tempDir, `chunk_${i}_${Date.now()}.wav`);
      await fs.writeFile(tempFile, audioBuffers[i]);
      tempFiles.push(tempFile);
    }
    
    // Create output file path
    const outputFile = join(tempDir, `stitched_${Date.now()}.wav`);
    
    // Build FFmpeg filter complex for crossfading
    const filterComplex = buildCrossfadeFilter(audioBuffers.length, crossfadeMs / 1000);
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      // Add all input files
      tempFiles.forEach(file => {
        command = command.input(file);
      });
      
      // Apply crossfade filter and output settings
      command
        .complexFilter(filterComplex)
        .audioChannels(mono ? 1 : 2)
        .audioFrequency(sampleRate)
        .audioCodec('pcm_s16le')
        .format('wav')
        .output(outputFile)
        .on('end', async () => {
          try {
            const result = await fs.readFile(outputFile);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
    
  } finally {
    // Cleanup temporary files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${file}:`, error);
      }
    }
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
    // Write input buffer to file
    await fs.writeFile(inputFile, audioBuffer);
    
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
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
    
  } finally {
    // Cleanup
    try {
      await fs.unlink(inputFile);
      await fs.unlink(outputFile);
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
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
    // Write input buffer to file
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
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
    
  } finally {
    // Cleanup
    try {
      await fs.unlink(inputFile);
      await fs.unlink(outputFile);
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
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
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
    
  } finally {
    // Cleanup
    try {
      await fs.unlink(inputFile);
      await fs.unlink(outputFile);
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
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
        .on('end', () => {
          // TODO: Parse FFmpeg output for actual measurements
          // For now, return placeholder values
          resolve({
            durationSec: audioBuffer.length / (44100 * 2 * 2), // Rough estimate
            lufsIntegrated: -14.0, // Placeholder
            truePeakDb: -1.0, // Placeholder
            joinEnergySpikes: [], // TODO: Implement spike detection
          });
        })
        .on('error', reject)
        .run();
    });
    
  } finally {
    try {
      await fs.unlink(inputFile);
    } catch (error) {
      console.warn('Failed to cleanup analysis temp file:', error);
    }
  }
}
