/**
 * API route for text preparation and processing
 * Handles normalization, linting, macro application, and chunking
 * according to Angela voice styling guidelines.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  loadConfig,
  normalize,
  lint,
  applyMacros,
  applyConversationalRealism,
  applyWST2Rules,
  sanitizeForTTS,
  applyAudioTags, // Audio tags for v3 emotional delivery
  toSSML,
  chunk,
  type TextChunk,
  type LintReport,

  type VoiceConfig,
} from '@/lib/styling';
import { saveManifest } from '@/lib/store';

/**
 * Request schema validation
 */
const PrepareRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  output: z.enum(['ssml', 'text']).default('text'), // Changed default to 'text' for V3
  preset: z.string().default('angela'),
  processingMode: z.enum(['angela_v3']).optional().default('angela_v3'), // Single unified processing mode
});



/**
 * Response interface
 */
interface PrepareResponse {
  manifestId: string;
  chunks: Array<{
    id: number;
    body: string;
    estSeconds: number;
  }>;
  report: LintReport;
  processing?: {
    originalText: string;
    normalized: string;
    withMacros: string;
    conversational: string;
    wst2Formatted: string;
    withAudioTags: string; // NEW: Audio tags processing step
    sanitized: string;
    finalOutput: string;
    pipeline: Array<{
      step: string;
      description: string;
    }>;
  };
}

/**
 * POST /api/prepare
 * Processes raw text through the complete styling pipeline
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await req.json();
    console.log('🔍 Raw request body:', { 
      processingMode: body.processingMode, 
      hasText: !!body.text,
      textLength: body.text?.length 
    });
    
    const { text, output, processingMode } = PrepareRequestSchema.parse(body);
    console.log('🔍 After schema validation:', { processingMode, output });

    // Check input length limits
    const maxChars = parseInt(process.env.MAX_INPUT_CHARS || '20000');
    if (text.length > maxChars) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${maxChars} characters allowed.` },
        { status: 400 }
      );
    }

    // Load voice configuration
    const config = await loadConfig();

    // Single unified processing mode - Angela V3 Best Practices
    console.log('🎭 Using Angela V3 Unified Processing Mode');
    return await processAngelaV3Mode(text, config, output);

    // This should never be reached - all processing goes through processAngelaV3Mode
    throw new Error('Legacy processing pipeline removed - use Angela V3 unified mode');

  } catch (error) {
    console.error('Error in /api/prepare:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prepare
 * Returns API documentation and usage information
 */
export async function GET(): Promise<NextResponse> {
  const documentation = {
    endpoint: '/api/prepare',
    method: 'POST',
    description: 'Processes raw text through Angela voice styling pipeline',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Raw text to process for TTS synthesis',
        maxLength: parseInt(process.env.MAX_INPUT_CHARS || '20000'),
      },
      output: {
        type: 'string',
        required: false,
        default: 'ssml',
        enum: ['ssml', 'text'],
        description: 'Output format preference',
      },
      preset: {
        type: 'string',
        required: false,
        default: 'angela',
        description: 'Voice preset to use for processing',
      },
    },
    response: {
      manifestId: 'string - Unique identifier for the processed text',
      chunks: 'array - Text chunks ready for synthesis',
      report: 'object - Linting report with warnings and statistics',
    },
    example: {
      request: {
        text: 'Hello, you guys. This is a test of the Angela voice system.',
        output: 'ssml',
        preset: 'angela',
      },
      response: {
        manifestId: 'uuid-string',
        chunks: [
          {
            id: 0,
            body: '<speak>Hello, you guys. This is a test of the Angela voice system.</speak>',
            estSeconds: 4.2,
          },
        ],
        report: {
          warnings: [],
          bans: [],
          stats: {
            words: 12,
            sentences: 2,
            groupAddressRatio: 0.5,
            consecutiveGroupAddress: 1,
          },
        },
      },
    },
  };

  return NextResponse.json(documentation);
}

/**
 * V3 Pure implementation - No legacy V2 code, just clean text + strategic audio tags
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function processV3OptimizedMode(text: string, config: VoiceConfig, _output: string) {
  try {
    console.log('🚀 V3 Pure Pipeline - Clean text with natural punctuation for V3 pacing');
    console.log('📝 Original text:', text.substring(0, 100) + '...');
    
    // Step 1: Apply Angela's pacing rules through natural punctuation for V3
    console.log('🔧 Step 1: Applying Angela\'s pacing rules via V3-compatible punctuation');
    const pacedText = applyV3NativePacing(text, config);
    console.log('✅ After V3 pacing:', pacedText.substring(0, 100) + '...');
    
    // Step 2: Apply conversational realism (Angela's voice characteristics)
    console.log('🗣️ Step 2: Applying Angela\'s conversational style');
    const conversationalText = applyV3ConversationalStyle(pacedText, config);
    console.log('✅ After conversational style:', conversationalText.substring(0, 100) + '...');
    
    // Step 3: Strategic audio tags - contextual placement
    console.log('🎭 Step 3: Strategic audio tag placement');
    const taggedText = applyAudioTags(conversationalText, config);
    console.log('🏷️ After audio tags:', taggedText.substring(0, 100) + '...');
    
    // Step 4: Pure V3 chunking - NO markup, preserve natural text flow
    console.log('✂️ Step 4: Pure V3 chunking (no markup added)');
    const pureChunks = createPureV3Chunks(taggedText, config);
    console.log(`📦 Created ${pureChunks.length} pure chunks (avg: ${Math.round(pureChunks.reduce((sum, c) => sum + c.charCount, 0) / pureChunks.length)} chars each)`);
    
    // Step 5: Validation - count audio tags
    const audioTagMatches = taggedText.match(/\[[\w\s]+\]/g) || [];
    console.log(`🎯 Audio tags in final text: ${audioTagMatches.length} tags found`);
    console.log('🎭 Audio tags:', audioTagMatches.slice(0, 5));
    
    // Generate manifest
    const manifestId = await saveManifest(pureChunks, {
      report: { 
        warnings: [],
        bans: [],
        stats: { 
          words: taggedText.split(' ').length, 
          sentences: taggedText.split(/[.!?]+/).length - 1,
          groupAddressRatio: 0,
          consecutiveGroupAddress: 0
        }
      },
      configVersion: 'v3-pure-2025',
      originalText: text,
    });

    return NextResponse.json({
      manifestId,
      chunks: pureChunks,
      report: {
        warnings: [],
        bans: []
      },
      processing: {
        originalText: text,
        normalized: pacedText,
        withAudioTags: taggedText,
        finalOutput: taggedText,
        audioTags: audioTagMatches,
        chunkCount: pureChunks.length,
        avgChunkSize: Math.round(pureChunks.reduce((sum, c) => sum + c.charCount, 0) / pureChunks.length),
        pipeline: [
          { step: 'v3_native_pacing', description: 'Apply Angela\'s pacing rules via natural punctuation' },
          { step: 'conversational_style', description: 'Apply Angela\'s conversational voice characteristics' },
          { step: 'strategic_audio_tags', description: 'Contextual audio tags for emotional delivery' },
          { step: 'pure_v3_chunking', description: 'Clean chunks with no markup added' }
        ]
      }
    });

  } catch (error) {
    console.error('❌ V3 pure processing error:', error);
    return NextResponse.json({ error: 'Failed to process text with V3 pure pipeline' }, { status: 500 });
  }
}

/**
 * Direct processing mode - minimal processing for user-edited text
 * Skips all transformations and uses text as-is
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function processDirectMode(text: string, config: VoiceConfig, _output: string) {
  try {
    console.log('🎯 Direct Mode - Using edited text as-is (no processing)');
    console.log('📝 Direct text preview:', text.substring(0, 100) + '...');
    
    // Create chunks directly from the edited text without any processing
    const directChunks = createPureV3Chunks(text, config);
    console.log(`📦 Created ${directChunks.length} direct chunks (avg: ${Math.round(directChunks.reduce((sum, c) => sum + c.charCount, 0) / directChunks.length)} chars each)`);
    
    // Count any existing audio tags in the edited text
    const audioTagMatches = text.match(/\[[\w\s]+\]/g) || [];
    console.log(`🎯 Audio tags in edited text: ${audioTagMatches.length} tags found`);
    if (audioTagMatches.length > 0) {
      console.log('🎭 Audio tags:', audioTagMatches.slice(0, 5));
    }
    
    // Generate manifest
    const manifestId = await saveManifest(directChunks, {
      report: { 
        warnings: [],
        bans: [],
        stats: { 
          words: text.split(' ').length, 
          sentences: text.split(/[.!?]+/).length - 1,
          groupAddressRatio: 0,
          consecutiveGroupAddress: 0
        }
      },
      configVersion: 'direct-2025',
      originalText: text,
    });

    return NextResponse.json({
      manifestId,
      chunks: directChunks,
      report: {
        warnings: [],
        bans: []
      },
      processing: {
        originalText: text,
        normalized: text, // No normalization in direct mode
        finalOutput: text, // Use text as-is
        audioTags: audioTagMatches,
        stats: {
          words: text.split(' ').length,
          sentences: text.split(/[.!?]+/).length - 1,
          chunks: directChunks.length,
          estSeconds: directChunks.reduce((sum, chunk) => sum + chunk.estSeconds, 0)
        }
      }
    });

  } catch (error) {
    console.error('Direct processing error:', error);
    return NextResponse.json({ error: 'Failed to process text in direct mode' }, { status: 500 });
  }
}

/**
 * Angela V3 Unified Processing Mode - Single best-practice pipeline
 * Applies Angela's voice rules with full audio tag support and consistent pacing
 */
async function processAngelaV3Mode(text: string, config: VoiceConfig, _output: string) {
  try {
    console.log('🎭 Angela V3 Unified Pipeline - Best-practice processing with full audio tag support');
    console.log('📝 Input text:', text.substring(0, 100) + '...');
    
    // Step 1: Apply Angela's pacing rules (preserve user edits but ensure proper timing)
    console.log('🔧 Step 1: Applying Angela\'s pacing rules (gentle enhancement)');
    const pacedText = applyV3NativePacing(text, config);
    console.log('✅ After V3 pacing:', pacedText.substring(0, 100) + '...');
    
    // Step 2: Apply Angela's conversational style (but preserve user's punctuation choices)
    console.log('🗣️ Step 2: Applying Angela\'s conversational characteristics');
    const conversationalText = applyV3ConversationalStyle(pacedText, config);
    console.log('✅ After conversational style:', conversationalText.substring(0, 100) + '...');
    
    // Step 3: Strategic audio tags - contextual placement (respecting existing tags)
    console.log('🎭 Step 3: Strategic audio tag placement (preserving user tags)');
    
    // Check if user has already added audio tags - if so, skip automatic tagging
    const existingTags = (conversationalText.match(/\[[\w\s]+\]/g) || []).length;
    let taggedText = conversationalText;
    
    if (existingTags === 0) {
      console.log('🎭 No existing user tags found, applying contextual tags');
      taggedText = applyAudioTags(conversationalText, config);
    } else {
      console.log(`🎭 Found ${existingTags} existing user tags, preserving them without adding more`);
    }
    
    console.log('🏷️ After audio tags:', taggedText.substring(0, 100) + '...');
    
    // Step 4: Pure V3 chunking - NO markup, preserve natural text flow
    console.log('✂️ Step 4: Pure V3 chunking (no markup added)');
    const pureChunks = createPureV3Chunks(taggedText, config);
    console.log(`📦 Created ${pureChunks.length} enhanced chunks (avg: ${Math.round(pureChunks.reduce((sum, c) => sum + c.charCount, 0) / pureChunks.length)} chars each)`);
    
    // Step 5: Validation - count audio tags
    const audioTagMatches = taggedText.match(/\[[\w\s]+\]/g) || [];
    console.log(`🎯 Audio tags in enhanced text: ${audioTagMatches.length} tags found`);
    console.log('🎭 Audio tags:', audioTagMatches.slice(0, 5));
    
    const manifestId = await saveManifest(pureChunks, {
      config,
      metadata: {
        processingMode: 'v3_enhanced',
        originalLength: text.length,
        processedLength: taggedText.length,
        audioTags: audioTagMatches.length,
        timestamp: new Date().toISOString()
      }
    });

    const stats = {
      words: taggedText.split(' ').length,
      sentences: taggedText.split(/[.!?]+/).length - 1,
      chunks: pureChunks.length,
      estSeconds: pureChunks.reduce((sum, chunk) => sum + chunk.estSeconds, 0)
    };

    return NextResponse.json({
      manifestId,
      chunks: pureChunks,
      report: {
        warnings: [],
        bans: []
      },
      processing: {
        originalText: text,
        normalized: conversationalText,
        finalOutput: taggedText,
        audioTags: audioTagMatches,
        stats
      }
    });

  } catch (error) {
    console.error('V3 Enhanced processing error:', error);
    return NextResponse.json({ error: 'Failed to process text in V3 enhanced mode' }, { status: 500 });
  }
}

/**
 * Pure V3 chunking - creates clean chunks with NO markup added
 * Preserves natural punctuation and spacing for V3's built-in pacing
 */
function createPureV3Chunks(text: string, config: VoiceConfig): Array<{
  id: number;
  body: string;
  charCount: number;
  estSeconds: number;
}> {
  const maxChars = config.chunking.max_chars || 2200;
  const minChars = config.chunking.min_chars || 900;
  
  // Split on natural boundaries - sentences and paragraphs
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: Array<{ id: number; body: string; charCount: number; estSeconds: number }> = [];
  let currentChunk = '';
  let chunkId = 0;
  
  for (const sentence of sentences) {
    const testChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    
    if (testChunk.length <= maxChars) {
      currentChunk = testChunk;
    } else {
      // Finalize current chunk if it meets minimum
      if (currentChunk && currentChunk.length >= minChars) {
        chunks.push({
          id: chunkId++,
          body: currentChunk.trim(),
          charCount: currentChunk.length,
          estSeconds: estimateSeconds(currentChunk),
        });
      }
      currentChunk = sentence;
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: chunkId,
      body: currentChunk.trim(),
      charCount: currentChunk.length,
      estSeconds: estimateSeconds(currentChunk),
    });
  }
  
  return chunks;
}

/**
 * Estimate duration based on word count and natural speech rate
 */
function estimateSeconds(text: string): number {
  const words = text.split(/\s+/).length;
  const wpm = 135; // From config
  return Math.round((words / wpm) * 60 * 10) / 10;
}

/**
 * Apply Angela's pacing rules using V3-compatible natural punctuation
 * Converts specific timing requirements to strategic punctuation patterns
 */
function applyV3NativePacing(text: string, config: VoiceConfig): string {
  let paced = text;
  
  console.log('⏱️ Applying Angela\'s pacing timing via natural punctuation');
  
  // Angela's timing rules (from config):
  // micro: 400ms - very slight hesitation
  // beat: 700ms - micro-beat for rhythmic control  
  // minor: 1200ms - after punchlines, pivots, reflection
  // shift: 1800ms - emotional shift, paragraph break
  // impact: 2300ms - impact line landing
  // major: 3500ms - major mood shift, breath reset
  
  // Apply strategic ellipses for contemplative pauses (minor timing: 1200ms)
  // Target: after significant statements, before insights
  paced = paced.replace(/(card|cards)\./gi, '$1...');
  paced = paced.replace(/\b(different|shift|change)\./gi, '$1...');
  paced = paced.replace(/\b(listen|look|see|notice)\s/gi, '$1... ');
  
  // ENHANCED: Longer pauses with multiple ellipses (impact timing: 2300ms)
  paced = paced.replace(/\b(pause|wait|think|consider)\./gi, '$1...');
  paced = paced.replace(/\.\s+(So|Now|Here's the thing|And here's what)\s/gi, '... $1 ');
  
  // Apply em-dashes for emotional shifts and emphasis (shift timing: 1800ms)
  // Replace some periods with em-dashes for dramatic pauses
  paced = paced.replace(/\.\s+(But|And|Yet|Still|Now)\s/gi, ' — $1 ');
  paced = paced.replace(/\.\s+(This is|That's|Here's)\s/gi, ' — $1 ');
  
  // ENHANCED: Double em-dashes for major mood shifts (major timing: 3500ms)
  paced = paced.replace(/\.\s+(So here's|The thing is|What's happening)\s/gi, ' —— $1 ');
  
  // Add subtle pauses after rhetorical questions (beat timing: 700ms)
  paced = paced.replace(/\?(\s+[A-Z])/g, '?  $1');
  
  // ENHANCED: Longer paragraph breaks for major mood shifts
  paced = paced.replace(/\n\n+/g, '\n\n\n');
  
  // REMOVED: Automatic card name spacing - cards already have natural pauses
  // paced = paced.replace(/\b(High Priestess|The Hermit|The Star|Ten of Wands)\b/gi, ' $1... ');
  
  // ENHANCED: Extended pauses at sentence endings that need reflection
  paced = paced.replace(/\.\s+(Because|Since|When|If|As|While)\s/gi, '... $1 ');
  
  // Normalize excessive spaces while preserving intentional pauses
  paced = paced.replace(/\s{3,}/g, '  '); // Max double space for natural pause
  paced = paced.trim();
  
  return paced;
}

/**
 * Apply Angela's conversational style characteristics for V3
 * Implements her specific voice patterns and hesitation cues
 */
function applyV3ConversationalStyle(text: string, config: VoiceConfig): string {
  let styled = text;
  
  console.log('🗣️ Applying Angela\'s conversational characteristics');
  
  // Apply "you guys" ratio (35% of "you" should become "you guys")
  const youMatches = styled.match(/\byou\b(?!\s+guys)/gi) || [];
  const targetYouGuysCount = Math.floor(youMatches.length * config.conversational_realism.you_guys_ratio);
  
  let youGuysApplied = 0;
  styled = styled.replace(/\byou\b(?!\s+guys)(?!\s+are\s+(going|gonna|about))/gi, (match) => {
    if (youGuysApplied < targetYouGuysCount && Math.random() < 0.4) {
      youGuysApplied++;
      return 'you guys';
    }
    return match;
  });
  
  // Add verbal hesitation cues (35% of natural pause points)
  const hesitationCues = config.speech_patterns?.hesitation_cues || ['yeah', 'like', 'so yeah', 'I mean'];
  
  // Add hesitation before significant insights
  styled = styled.replace(/\.\s+(This|That|Here's|What|And)\s/gi, (match, word) => {
    if (Math.random() < config.conversational_realism.verbal_hesitation_ratio) {
      const cue = hesitationCues[Math.floor(Math.random() * hesitationCues.length)];
      return `. ${cue}, ${word.toLowerCase()} `;
    }
    return match;
  });
  
  // Apply mystical vocabulary grounding (if enabled)
  if (config.conversational_realism.mystical_vocabulary) {
    const replacements = config.speech_patterns?.mystical_replacements || {};
    Object.entries(replacements).forEach(([mystical, grounded]) => {
      const regex = new RegExp(mystical, 'gi');
      styled = styled.replace(regex, grounded);
    });
  }
  
  // Clean up any double spaces that may have been introduced
  styled = styled.replace(/\s{2,}/g, ' ').trim();
  
  return styled;
}

/**
 * Natural processing mode for ElevenLabs v3
 * Simplified pipeline focused on natural text and audio tags
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function processNaturalMode(text: string, config: VoiceConfig, _output: string) {
  try {
    console.log('🎭 v3 Comprehensive Pipeline - Starting full processing');
    console.log('📝 Original text:', text.substring(0, 100) + '...');
    
    // Step 1: Complete processing pipeline (normalize → lint → macros → conversational → wst2)
    console.log('🔧 Step 1: Full text processing pipeline');
    let processedText = normalize(text, config);
    const lintReport = lint(processedText, config);
    processedText = applyMacros(processedText, config);
    processedText = applyConversationalRealism(processedText, config);
    processedText = applyWST2Rules(processedText, config);
    console.log('✅ After full processing:', processedText.substring(0, 100) + '...');
    
    // Step 2: Apply comprehensive audio tags for v3
    console.log('🎭 Step 2: Applying comprehensive v3 audio tags');
    const taggedText = applyAudioTags(processedText, config);
    console.log('🏷️ After audio tags:', taggedText.substring(0, 100) + '...');
    
    // Step 3: Final sanitization (model-aware for v3)
    console.log('🧹 Step 3: Model-aware sanitization for v3');
    const cleanText = sanitizeForTTS(taggedText, config);
    console.log('✨ After sanitization:', cleanText.substring(0, 100) + '...');
    
    // Step 4: SSML conversion if needed
    let finalText = cleanText;
    if (config.emphasis?.use_ssml && output === 'ssml') {
      console.log('📄 Converting to SSML');
      finalText = toSSML(cleanText, config);
    }
    
    // Step 5: Optimized chunking for v3
    console.log('✂️ Step 4: Creating optimized chunks for v3');
    const chunks = chunk(finalText, config);
    console.log(`📦 Created ${chunks.length} chunks (avg: ${Math.round(chunks.reduce((sum, c) => sum + c.charCount, 0) / chunks.length)} chars each)`);
    
    // Step 6: Count and log audio tags for validation
    const audioTagMatches = finalText.match(/\[[\w\s]+\]/g) || [];
    console.log(`🎯 Audio tags in final text: ${audioTagMatches.length} tags found`);
    if (audioTagMatches.length > 0) {
      console.log('🏷️ Audio tags list:', audioTagMatches.slice(0, 10).join(', ') + (audioTagMatches.length > 10 ? '...' : ''));
    }
    
    // Step 7: Generate manifest
    const manifestId = await saveManifest(chunks, {
      report: { 
        warnings: lintReport.warnings, 
        bans: lintReport.bans,
        stats: lintReport.stats
      },
      configVersion: 'comprehensive-v3',
      originalText: text,
    });

    return NextResponse.json({
      manifestId,
      chunks,
      report: {
        warnings: lintReport.warnings,
        bans: lintReport.bans
      },
      processing: {
        originalText: text,
        processedText: processedText,
        withAudioTags: taggedText,
        finalOutput: finalText,
        audioTags: audioTagMatches,
        chunkCount: chunks.length,
        avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.charCount, 0) / chunks.length),
        pipeline: [
          { step: 'normalization', description: 'Text normalization and cleanup' },
          { step: 'linting', description: 'Style and content validation' },
          { step: 'macros', description: 'Apply voice macros and shortcuts' },
          { step: 'conversational', description: 'Apply conversational realism' },
          { step: 'wst2_rules', description: 'Apply WST2 styling rules' },
          { step: 'audio_tags', description: 'Apply comprehensive v3 audio tags' },
          { step: 'sanitization', description: 'Final cleanup preserving audio tags' },
          { step: 'chunking', description: 'Optimized chunking for v3' }
        ]
      }
    });

  } catch (error) {
    console.error('❌ v3 processing error:', error);
    return NextResponse.json({ error: 'Failed to process text with v3 pipeline' }, { status: 500 });
  }
}


