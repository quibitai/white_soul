/**
 * ElevenLabs TTS client for White Soul Tarot
 * Handles text-to-speech synthesis using ElevenLabs API with Angela's voice
 */

import { VoiceConfig } from '../styling/config';
import { 
  sanitizeForModel, 
  getModelCapabilities, 
  getRecommendedSettings
} from './model-caps';
// import { selectDictionaries, toElevenLabsFormat } from './pronunciation'; // Temporarily disabled

export interface TTSOptions {
  text: string;
  voiceId: string;
  modelId: string;
  format: 'mp3_44100_128' | 'mp3_44100_192' | 'wav';
  seed?: number;
  previousText?: string;
  nextText?: string;
  previousRequestIds?: string[]; // For request stitching consistency
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
    previousRequestIds = [],
    pronunciationDictionaries = [],
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
  
  console.log('🎙️ ElevenLabs v2 TTS:', {
    model: modelId,
    textLength: text.length,
    hasSSML: /<[^>]+>/.test(text),
    contextProvided: !!(previousText || nextText),
    requestStitching: previousRequestIds.length > 0
  });
  
  // Sanitize text for v2 model
  const sanitizedText = sanitizeForModel(text.trim(), modelId);
  
  // Get recommended voice settings
  const recommendedSettings = getRecommendedSettings(modelId);
  
  // Merge voice settings with recommended defaults
  const finalVoiceSettings = {
    ...recommendedSettings,
    ...voiceSettings,
  };

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format}`;
  
  const requestBody: Record<string, unknown> = {
    text: sanitizedText,
    model_id: modelId,
    voice_settings: finalVoiceSettings,
    ...(seed && { seed }),
    ...(speed && { speed }),
    ...(quality && { quality }),
  };

  // Add context parameters for better continuity
  if (previousText) {
    requestBody.previous_text = previousText.slice(-300);
  }
  if (nextText) {
    requestBody.next_text = nextText.slice(0, 300);
  }

  // Add request stitching for voice consistency
  if (previousRequestIds.length > 0) {
    requestBody.previous_request_ids = previousRequestIds.slice(-2); // Last 2 requests
  }

  // Add pronunciation dictionaries if supported
  if (modelCaps.supportsPronunciationDictionaries && pronunciationDictionaries.length > 0) {
    requestBody.pronunciation_dictionary_locators = pronunciationDictionaries
      .slice(0, modelCaps.maxDictionaries)
      .map(id => ({ pronunciation_dictionary_id: id }));
  }

  // Enable SSML parsing if needed
  if (enableSSMLParsing || modelCaps.supportsSSML) {
    requestBody.enable_ssml_parsing = true;
  }

  console.log('🚀 ElevenLabs v2 Request:', {
    endpoint: url,
    textPreview: sanitizedText.substring(0, 100) + '...',
    voiceSettings: finalVoiceSettings,
    hasContext: !!(requestBody.previous_text || requestBody.next_text),
    stitchingIds: previousRequestIds.length
  });

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
    const requestId = response.headers.get('request-id') || undefined;

    console.log('✅ ElevenLabs v2 Success:', {
      audioSize: audioBuffer.length,
      requestId,
      duration: `${Math.round(audioBuffer.length / 44100 / 2)}s (estimated)`
    });

    return {
      audio: audioBuffer,
      requestId,
    };
  } catch (error) {
    console.error('❌ ElevenLabs v2 Error:', error);
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

  // Model ID determined from baseOptions, env, or config
  const modelId = baseOptions.modelId || process.env.ELEVEN_MODEL_ID || config.voice.model_id;
  
  console.log(`🚀 Processing ${chunks.length} chunks with v2 request stitching for voice consistency`);

  // Prepare pronunciation dictionaries from config
  const pronunciationDictionaries = config.pronunciation?.default_dictionaries || [];
  
  // Track request IDs for stitching
  const requestIds: string[] = [];
  const results: Buffer[] = [];

  // Process chunks sequentially to maintain request stitching chain
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const previousText = i > 0 ? chunks[i - 1].slice(-300) : undefined;
    const nextText = i < chunks.length - 1 ? chunks[i + 1].slice(0, 300) : undefined;

    const options: TTSOptions = {
      text: chunk,
      voiceId: baseOptions.voiceId || process.env.ELEVEN_VOICE_ID || config.voice.voice_id,
      modelId: baseOptions.modelId || process.env.ELEVEN_MODEL_ID || config.voice.model_id,
      format: baseOptions.format || 'mp3_44100_128',
      seed: baseOptions.seed || config.voice.seed,
      previousText,
      nextText,
      previousRequestIds: requestIds.slice(-3), // Last 3 requests for better consistency
      pronunciationDictionaries,
      enableSSMLParsing: config.emphasis?.use_ssml || false,
      voiceSettings: {
        stability: config.voice.settings.stability,
        similarity_boost: config.voice.settings.similarity_boost,
        style: config.voice.settings.style,
        use_speaker_boost: config.voice.settings.speaker_boost,
      },
    };

    const startTime = Date.now();
    try {
      const result = await ttsChunk(options);
      const endTime = Date.now();
      
      // Store request ID for next chunk's stitching
      if (result.requestId) {
        requestIds.push(result.requestId);
      }
      
      results.push(result.audio);
      
      console.log(`📦 Chunk ${i + 1}/${chunks.length} synthesized in ${endTime - startTime}ms (${chunk.length} chars, requestId: ${result.requestId?.slice(-8)})`);
      
      // Enhanced delay between requests for voice consistency and API stability
      if (i < chunks.length - 1) {
        // Progressive delay: longer for first few chunks to establish voice consistency
        const baseDelay = 300; // Increased from 100ms
        const progressiveDelay = i < 3 ? baseDelay + (i * 100) : baseDelay;
        console.log(`⏱️ Waiting ${progressiveDelay}ms for voice consistency (chunk ${i + 1}/${chunks.length})`);
        await new Promise(resolve => setTimeout(resolve, progressiveDelay));
      }
    } catch (error) {
      console.error(`❌ Failed to synthesize chunk ${i + 1}:`, error);
      throw error;
    }
  }
  
  console.log(`✅ Sequential synthesis with request stitching complete: ${results.length} chunks, ${requestIds.length} request IDs tracked`);

  return results;
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
