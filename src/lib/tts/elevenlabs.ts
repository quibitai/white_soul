/**
 * ElevenLabs TTS client for White Soul Tarot
 * Handles text-to-speech synthesis using ElevenLabs API with Angela's voice
 */

import { VoiceConfig } from '../styling/config';

export interface TTSOptions {
  text: string;
  voiceId: string;
  modelId: string;
  format: 'mp3_44100_128' | 'mp3_44100_192' | 'wav';
  seed?: number;
  previousText?: string;
  nextText?: string;
}

export interface TTSResponse {
  audio: Buffer;
  requestId?: string;
}

/**
 * Synthesizes text to speech using ElevenLabs API
 * @param {TTSOptions} options - TTS synthesis options
 * @returns {Promise<TTSResponse>} Audio buffer and metadata
 */
export async function ttsChunk(options: TTSOptions): Promise<TTSResponse> {
  const { text, voiceId, modelId, format, seed, previousText, nextText } = options;

  if (!text?.trim()) {
    throw new Error('Text is required for TTS synthesis');
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format}`;
  
  const requestBody = {
    text: text.trim(),
    model_id: modelId,
    voice_settings: {
      stability: 0.35,
      similarity_boost: 0.8,
      style: 0.2,
      speaker_boost: true,
    },
    ...(seed && { seed }),
    ...(previousText && { previous_text: previousText }),
    ...(nextText && { next_text: nextText }),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audio: audioBuffer,
      requestId: response.headers.get('request-id') || undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`TTS synthesis failed: ${error.message}`);
    }
    throw new Error('TTS synthesis failed: Unknown error');
  }
}

/**
 * Synthesizes multiple text chunks with continuity context
 * @param {string[]} chunks - Array of text chunks to synthesize
 * @param {VoiceConfig} config - Voice configuration
 * @param {Partial<TTSOptions>} baseOptions - Base options for all chunks
 * @returns {Promise<Buffer[]>} Array of audio buffers
 */
export async function synthesizeChunks(
  chunks: string[],
  config: VoiceConfig,
  baseOptions: Partial<TTSOptions> = {}
): Promise<Buffer[]> {
  if (!chunks || chunks.length === 0) {
    return [];
  }

  const audioBuffers: Buffer[] = [];
  let previousText: string | undefined;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const nextText = i < chunks.length - 1 ? chunks[i + 1].slice(0, 300) : undefined;

    const options: TTSOptions = {
      text: chunk,
      voiceId: baseOptions.voiceId || process.env.ELEVEN_VOICE_ID || config.voice.voice_id,
      modelId: baseOptions.modelId || process.env.ELEVEN_MODEL_ID || config.voice.model_id,
      format: baseOptions.format || 'mp3_44100_128',
      seed: baseOptions.seed || config.voice.seed,
      previousText,
      nextText,
    };

    const result = await ttsChunk(options);
    audioBuffers.push(result.audio);

    // Set previous text for next iteration (last ~300 chars for continuity)
    previousText = chunk.slice(-300);
  }

  return audioBuffers;
}

/**
 * Concatenates audio buffers into a single buffer
 * @param {Buffer[]} audioBuffers - Array of audio buffers to concatenate
 * @returns {Buffer} Concatenated audio buffer
 */
export function concatAudioBuffers(audioBuffers: Buffer[]): Buffer {
  if (!audioBuffers || audioBuffers.length === 0) {
    return Buffer.alloc(0);
  }

  if (audioBuffers.length === 1) {
    return audioBuffers[0];
  }

  return Buffer.concat(audioBuffers);
}

/**
 * Validates ElevenLabs API configuration
 * @returns {Promise<boolean>} True if configuration is valid
 */
export async function validateElevenLabsConfig(): Promise<boolean> {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return false;
    }

    // Test API key with a simple request to get voices
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Gets available voices from ElevenLabs API
 * @returns {Promise<any[]>} Array of available voices
 */
export async function getAvailableVoices(): Promise<any[]> {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get available voices: ${error.message}`);
    }
    throw new Error('Failed to get available voices: Unknown error');
  }
}
