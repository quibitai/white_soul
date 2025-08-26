/**
 * WebSocket streaming TTS for ElevenLabs
 * Provides real-time audio streaming with SSML tag preservation
 */

import { sanitizeForModel, getModelCapabilities } from './model-caps';
import { selectDictionaries, toElevenLabsFormat } from './pronunciation';

export interface StreamingOptions {
  voiceId: string;
  modelId: string;
  text: string;
  seed?: number;
  previousText?: string;
  nextText?: string;
  pronunciationDictionaries?: string[];
  onAudioChunk?: (chunk: ArrayBuffer) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  // New streaming optimization options
  chunkLengthSchedule?: number[];
  autoMode?: boolean;
  optimizeStreamingLatency?: boolean;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export interface StreamingResponse {
  close: () => void;
  send: (text: string) => void;
}

/**
 * Splits text for streaming while avoiding SSML tag splitting
 * @param {string} text - Text with potential SSML tags
 * @param {number} maxChunkSize - Maximum chunk size in characters
 * @returns {string[]} Array of text chunks with intact SSML tags
 */
export function splitTextForStreaming(text: string, maxChunkSize: number = 500): string[] {
  if (!text || text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  let inTag = false;
  let tagDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    currentChunk += char;

    // Track SSML tag state
    if (char === '<') {
      if (nextChar === '/') {
        tagDepth--;
      } else if (nextChar && nextChar !== ' ') {
        tagDepth++;
      }
      inTag = true;
    } else if (char === '>') {
      inTag = false;
    }

    // Check if we should split here
    const shouldSplit = 
      currentChunk.length >= maxChunkSize && 
      !inTag && 
      tagDepth === 0 && 
      /[.!?]\s/.test(currentChunk.slice(-2)); // End on sentence boundary

    if (shouldSplit) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
  }

  // Add remaining text
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Creates a streaming TTS connection using WebSocket
 * @param {StreamingOptions} options - Streaming configuration
 * @returns {Promise<StreamingResponse>} Streaming connection interface
 */
export async function createStreamingTTS(options: StreamingOptions): Promise<StreamingResponse> {
  const {
    voiceId,
    modelId,
    text,
    seed,
    previousText,
    nextText,
    pronunciationDictionaries = [],
    onAudioChunk,
    onComplete,
    onError,
    chunkLengthSchedule = [50, 120, 160, 290],
    autoMode = true,
    optimizeStreamingLatency = true,
    voiceSettings,
  } = options;

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  // Check if model supports WebSocket
  const modelCaps = getModelCapabilities(modelId);
  if (!modelCaps.supportsWebSocket) {
    throw new Error(`Model ${modelId} does not support WebSocket streaming`);
  }

  // Sanitize text for the model
  const sanitizedText = sanitizeForModel(text, modelId);

  // Prepare pronunciation dictionaries
  const selectedDictionaries = selectDictionaries(pronunciationDictionaries, modelCaps.maxDictionaries);
  const pronunciationData = toElevenLabsFormat(selectedDictionaries);

  // WebSocket URL for ElevenLabs streaming with API key as query parameter
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}&xi-api-key=${process.env.ELEVENLABS_API_KEY}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    let isConnected = false;

    ws.onopen = () => {
      isConnected = true;

      // Send initial configuration
      const defaultVoiceSettings = {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.0,
        use_speaker_boost: true,
      };

      const config: Record<string, unknown> = {
        text: ' ', // Start with empty space
        voice_settings: {
          ...defaultVoiceSettings,
          ...voiceSettings,
        },
        generation_config: {
          chunk_length_schedule: chunkLengthSchedule,
          auto_mode: autoMode,
          optimize_streaming_latency: optimizeStreamingLatency,
        },
        ...(seed && { seed }),
        ...(previousText && { previous_text: previousText.slice(-300) }),
        ...(nextText && { next_text: nextText.slice(0, 300) }),
        enable_ssml_parsing: true,
      };

      // Add pronunciation dictionaries if available
      if (pronunciationData.length > 0) {
        config.pronunciation_dictionary_locators = pronunciationData;
      }

      ws.send(JSON.stringify(config));

      // Send the actual text in chunks to avoid SSML tag splitting
      const textChunks = splitTextForStreaming(sanitizedText);
      
      textChunks.forEach((chunk, index) => {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ text: chunk }));
          }
        }, index * 50); // Small delay between chunks
      });

      // Signal end of input
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ text: '' }));
        }
      }, textChunks.length * 50 + 100);

      resolve({
        close: () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        },
        send: (newText: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            const sanitized = sanitizeForModel(newText, modelId);
            const chunks = splitTextForStreaming(sanitized);
            chunks.forEach(chunk => {
              ws.send(JSON.stringify({ text: chunk }));
            });
          }
        },
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.audio && onAudioChunk) {
          // Convert base64 audio to ArrayBuffer
          const audioData = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
          onAudioChunk(audioData.buffer);
        }

        if (data.isFinal && onComplete) {
          onComplete();
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      const wsError = new Error(`WebSocket error: ${error}`);
      if (onError) {
        onError(wsError);
      }
      if (!isConnected) {
        reject(wsError);
      }
    };

    ws.onclose = (event) => {
      if (!isConnected && event.code !== 1000) {
        reject(new Error(`WebSocket connection failed: ${event.code} ${event.reason}`));
      }
    };
  });
}

/**
 * Validates text for WebSocket streaming
 * @param {string} text - Text to validate
 * @param {string} modelId - Model ID to validate against
 * @returns {string[]} Array of validation warnings
 */
export function validateStreamingText(text: string, modelId: string): string[] {
  const warnings: string[] = [];
  const modelCaps = getModelCapabilities(modelId);

  if (!modelCaps.supportsWebSocket) {
    warnings.push(`Model ${modelId} does not support WebSocket streaming`);
  }

  // Check for potentially problematic SSML patterns
  const unclosedTags = text.match(/<[^/>][^>]*[^/]>/g);
  const closingTags = text.match(/<\/[^>]+>/g);
  
  if (unclosedTags && closingTags) {
    const openCount = unclosedTags.length;
    const closeCount = closingTags.length;
    
    if (openCount !== closeCount) {
      warnings.push(`Mismatched SSML tags: ${openCount} opening, ${closeCount} closing`);
    }
  }

  // Check text length for streaming efficiency
  if (text.length > 5000) {
    warnings.push('Text is very long for streaming - consider chunking for better performance');
  }

  return warnings;
}

/**
 * Estimates streaming latency based on text characteristics
 * @param {string} text - Text to analyze
 * @param {string} modelId - Model ID
 * @returns {object} Latency estimates
 */
export function estimateStreamingLatency(text: string, modelId: string): {
  firstChunkMs: number;
  totalDurationMs: number;
  chunksCount: number;
} {
  const chunks = splitTextForStreaming(text);
  
  // Base latency estimates (these would need tuning based on real measurements)
  const baseLatencyMs = modelId === 'eleven_turbo_v2' ? 200 : 400;
  const perChunkMs = modelId === 'eleven_turbo_v2' ? 50 : 100;
  
  return {
    firstChunkMs: baseLatencyMs,
    totalDurationMs: baseLatencyMs + (chunks.length * perChunkMs),
    chunksCount: chunks.length,
  };
}
