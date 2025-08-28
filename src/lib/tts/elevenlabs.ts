/**
 * ElevenLabs TTS client for White Soul Tarot
 * Handles text-to-speech synthesis using ElevenLabs API with Angela's voice
 */

import { VoiceConfig } from '../styling/config';
import { 
  sanitizeForModel, 
  getModelCapabilities, 
  getRecommendedSettings, 
  supportsAudioTags,
  getV3StabilityValue,
  isV3Model 
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
  
  // Log the raw text received before any processing
  console.log('🔍 ElevenLabs Raw Input Text:', {
    preview: text.substring(0, 200) + '...',
    length: text.length,
    hasMarkup: /<[^>]+>/.test(text) || /\[[^\]]+\]/.test(text),
    suspiciousContent: text.match(/hashtag|meta/gi) || [],
    audioTags: (text.match(/\[[^\]]+\]/g) || []).length
  });
  
  // For V3 models, detect if input is truly clean (no markup except audio tags)
  let sanitizedText;
  const hasLegacyMarkup = text.includes('<pause') || text.includes('<emphasis') || text.includes('<rate') || text.includes('<break') || text.includes('<speak');
  
  if (isV3Model(modelId) && !hasLegacyMarkup) {
    console.log('🚀 V3 Pure Input: Clean text detected, minimal processing');
    // Absolutely minimal processing for pure V3 input
    sanitizedText = text.trim()
      .replace(/\bhashtag\s+\w+\b/gi, '') // Remove any hashtag artifacts
      .replace(/\bmeta\b(?!\s+\w)/gi, '') // Remove standalone meta words
      .replace(/\s{3,}/g, '  ') // Normalize excessive whitespace but preserve double spaces for pacing
      .replace(/\n{3,}/g, '\n\n'); // Normalize excessive newlines but preserve paragraph breaks
      
    console.log('✨ V3 Pure: Preserving natural punctuation for V3 pacing');
  } else {
    console.log('🔧 Legacy/Markup Input: Full sanitization needed');
    sanitizedText = sanitizeForModel(text.trim(), modelId);
  }
  
  // Log the final text being sent to API
  console.log('🚀 Final Text to ElevenLabs:', {
    preview: sanitizedText.substring(0, 200) + '...',
    length: sanitizedText.length,
    audioTags: (sanitizedText.match(/\[[^\]]+\]/g) || []).length,
    remainingMarkup: (sanitizedText.match(/<[^>]+>/g) || []).length
  });
  
  // Get recommended voice settings for the model
  const recommendedSettings = getRecommendedSettings(modelId);
  
  // Check if this is a v3 model for special handling
  const isV3 = isV3Model(modelId);
  const supportsV3AudioTags = supportsAudioTags(modelId);

  // Select pronunciation dictionaries (max 3)
  // Note: Temporarily disabled until dictionaries are set up in ElevenLabs dashboard
  // const selectedDictionaries = selectDictionaries(pronunciationDictionaries, modelCaps.maxDictionaries);
  // const pronunciationData = toElevenLabsFormat(selectedDictionaries);

  // Use regular Text-to-Speech API - v3 model supports audio tags with this endpoint
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format}`;
  
  // Optimize voice settings for v3 models
  let finalVoiceSettings = {
    ...recommendedSettings,
    ...voiceSettings,
  };
  
  // Apply v3-specific optimizations
  if (isV3 && supportsV3AudioTags) {
    finalVoiceSettings = {
      ...finalVoiceSettings,
      // Use Creative mode for maximum emotional expressiveness
      stability: finalVoiceSettings.stability || getV3StabilityValue('creative'),
      // Higher similarity boost for better voice consistency in v3
      similarity_boost: Math.max(finalVoiceSettings.similarity_boost || 0.85, 0.85),
      // Style is not used in v3, but keep for compatibility
      style: 0.0,
    };
  }

  const requestBody: Record<string, unknown> = {
    text: sanitizedText,
    model_id: modelId,
    voice_settings: finalVoiceSettings,
    ...(seed && { seed }),
    ...(speed && { speed }), // Add speed control
    ...(quality && { quality }), // Add quality parameter
  };

  // Add context parameters only for non-v3 models (v3 doesn't support them)
  if (!isV3) {
    if (previousText) {
      requestBody.previous_text = previousText.slice(-300); // Limit context length
    }
    if (nextText) {
      requestBody.next_text = nextText.slice(0, 300); // Limit context length
    }
  }

  // Add pronunciation dictionaries if supported and available
  // Note: Pronunciation dictionaries must be pre-created in ElevenLabs dashboard
  // Temporarily disabled until dictionaries are set up
  // if (modelCaps.supportsPronunciationDictionaries && pronunciationData.length > 0) {
  //   requestBody.pronunciation_dictionary_locators = pronunciationData;
  // }

  // Enable SSML parsing for v3 models (required for audio tags) or WebSocket streaming
  if (isV3 || (enableSSMLParsing && modelCaps.supportsWebSocket)) {
    requestBody.enable_ssml_parsing = true;
  }

  // Enhanced debug logging for v3 models
  if (isV3) {
    const audioTagsFound = sanitizedText.match(/\[[^\]]+\]/g) || [];
    const isPureInput = !hasLegacyMarkup;
    console.log('🎭 ElevenLabs v3 Enhanced:', {
      modelId,
      endpoint: 'text-to-speech',
      url,
      textPreview: sanitizedText.substring(0, 200),
      audioTagsSupport: supportsV3AudioTags,
      audioTagsFound: audioTagsFound.length,
      audioTagsList: audioTagsFound.slice(0, 5), // Show first 5 tags
      enableSSMLParsing: requestBody.enable_ssml_parsing,
      inputType: isPureInput ? 'Pure V3 (natural punctuation preserved)' : 'Legacy (SSML converted)',
      optimizations: {
        contextParametersSkipped: 'v3 uses internal context understanding',
        stabilityMode: 'Creative mode for emotional expressiveness',
        punctuationPreserved: isPureInput,
        voiceSettings: finalVoiceSettings
      }
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
      
      // Enhanced error handling for v3 models
      let errorMessage = `ElevenLabs API error (${response.status}): ${errorText}`;
      
      if (isV3) {
        // v3-specific error suggestions
        if (response.status === 400) {
          errorMessage += '\n🎭 v3 Troubleshooting: Check audio tag format and ensure enable_ssml_parsing=true';
        } else if (response.status === 429) {
          errorMessage += '\n🎭 v3 Note: v3 model may have different rate limits than v2 models';
        } else if (response.status === 422) {
          errorMessage += '\n🎭 v3 Hint: Verify voice compatibility with v3 model and audio tag support';
        }
      }
      
      throw new Error(errorMessage);
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

  const modelId = baseOptions.modelId || process.env.ELEVEN_MODEL_ID || config.voice.model_id;
  const isV3 = isV3Model(modelId);
  
  console.log(`🚀 Processing ${chunks.length} chunks in ${isV3 ? 'parallel (v3)' : 'parallel'} mode`);

  // Prepare pronunciation dictionaries from config
  const pronunciationDictionaries = config.pronunciation?.default_dictionaries || [];

  // For v3 models, we can process completely in parallel since v3 has better context understanding
  // For v2 models, we still process in parallel but include context
  const chunkPromises = chunks.map(async (chunk, i) => {
    const previousText = isV3 ? undefined : (i > 0 ? chunks[i - 1].slice(-300) : undefined);
    const nextText = isV3 ? undefined : (i < chunks.length - 1 ? chunks[i + 1].slice(0, 300) : undefined);

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

    const startTime = Date.now();
    const result = await ttsChunk(options);
    const endTime = Date.now();
    
    console.log(`📦 Chunk ${i + 1}/${chunks.length} synthesized in ${endTime - startTime}ms (${chunk.length} chars)`);
    
    return {
      index: i,
      audio: result.audio,
      duration: endTime - startTime
    };
  });

  // Process all chunks in parallel with rate limiting
  const BATCH_SIZE = 5; // Process max 5 chunks simultaneously to avoid API rate limits
  const results: { index: number; audio: Buffer; duration: number }[] = [];
  
  for (let i = 0; i < chunkPromises.length; i += BATCH_SIZE) {
    const batch = chunkPromises.slice(i, i + BATCH_SIZE);
    console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunkPromises.length / BATCH_SIZE)} (${batch.length} chunks)`);
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // Small delay between batches to be respectful to API
    if (i + BATCH_SIZE < chunkPromises.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Sort results by index to maintain order
  results.sort((a, b) => a.index - b.index);
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = totalDuration / results.length;
  
  console.log(`✅ Parallel synthesis complete: ${results.length} chunks in ${totalDuration}ms total (avg: ${Math.round(avgDuration)}ms per chunk)`);

  return results.map(r => r.audio);
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
