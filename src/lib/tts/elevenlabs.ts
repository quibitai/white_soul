/**
 * ElevenLabs TTS client for White Soul Tarot
 * Handles text-to-speech synthesis using ElevenLabs API with Angela's voice
 */

import { VoiceConfig } from '../styling/config';
import { sanitizeForModel, getModelCapabilities, getRecommendedSettings } from './model-caps';
// import { selectDictionaries, toElevenLabsFormat } from './pronunciation'; // Temporarily disabled

export interface TTSOptions {
  text: string;
  voiceId: string;
  modelId: string;
  format: 'mp3_44100_128' | 'mp3_44100_192' | 'wav';
  seed?: number;
  previousText?: string;
  nextText?: string;
  pronunciationDictionaries?: string[]; // Dictionary IDs to use
  enableSSMLParsing?: boolean; // For WebSocket streaming
  speed?: number; // 0.7-1.2 range for speech speed control
  quality?: string; // "standard" | "enhanced"
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
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
  const { 
    text, 
    voiceId, 
    modelId, 
    format, 
    seed, 
    previousText, 
    nextText, 
    pronunciationDictionaries = [], // Temporarily unused
    enableSSMLParsing = false,
    speed,
    quality,
    voiceSettings
  } = options;

  if (!text?.trim()) {
    throw new Error('Text is required for TTS synthesis');
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  // Get model capabilities and sanitize text
  const modelCaps = getModelCapabilities(modelId);
  const sanitizedText = sanitizeForModel(text.trim(), modelId);
  
  // Get recommended voice settings for the model
  const recommendedSettings = getRecommendedSettings(modelId);

  // Select pronunciation dictionaries (max 3)
  // Note: Temporarily disabled until dictionaries are set up in ElevenLabs dashboard
  // const selectedDictionaries = selectDictionaries(pronunciationDictionaries, modelCaps.maxDictionaries);
  // const pronunciationData = toElevenLabsFormat(selectedDictionaries);

  // Use regular Text-to-Speech API - v3 model supports audio tags with this endpoint
  const isV3Model = modelId === 'eleven_v3' || modelId.startsWith('eleven_v3_preview');
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format}`;
  
  // Merge voice settings with any overrides
  const finalVoiceSettings = {
    ...recommendedSettings,
    ...voiceSettings,
  };

  const requestBody: Record<string, unknown> = {
    text: sanitizedText,
    model_id: modelId,
    voice_settings: finalVoiceSettings,
    ...(seed && { seed }),
    ...(previousText && { previous_text: previousText.slice(-300) }), // Limit context length
    ...(nextText && { next_text: nextText.slice(0, 300) }), // Limit context length
    ...(speed && { speed }), // Add speed control
    ...(quality && { quality }), // Add quality parameter
  };

  // Add pronunciation dictionaries if supported and available
  // Note: Pronunciation dictionaries must be pre-created in ElevenLabs dashboard
  // Temporarily disabled until dictionaries are set up
  // if (modelCaps.supportsPronunciationDictionaries && pronunciationData.length > 0) {
  //   requestBody.pronunciation_dictionary_locators = pronunciationData;
  // }

  // Enable SSML parsing for v3 models (required for audio tags) or WebSocket streaming
  if (isV3Model || (enableSSMLParsing && modelCaps.supportsWebSocket)) {
    requestBody.enable_ssml_parsing = true;
  }

  // Debug logging for v3 models
  if (isV3Model) {
    console.log('🎭 ElevenLabs v3 Debug:', {
      modelId,
      endpoint: 'text-to-speech',
      url,
      textPreview: sanitizedText.substring(0, 200),
      hasAudioTags: /\[[^\]]+\]/.test(sanitizedText),
      enableSSMLParsing: requestBody.enable_ssml_parsing,
      requestBody: { ...requestBody, text: '[TRUNCATED]' }
    });
  }

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

  // Prepare pronunciation dictionaries from config
  const pronunciationDictionaries = config.pronunciation?.default_dictionaries || [];

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
      pronunciationDictionaries,
      enableSSMLParsing: config.websocket?.enable_ssml_parsing || false,
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
export async function getAvailableVoices(): Promise<unknown[]> {
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
