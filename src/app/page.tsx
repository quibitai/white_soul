/**
 * Main page component for White Soul Tarot TTS application
 * Provides interface for text input, processing, and audio generation
 * using Angela voice styling with ElevenLabs TTS.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Play, Download, AlertCircle, Loader2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface LintReport {
  warnings: string[];
  bans: string[];
  stats: {
    words: number;
    sentences: number;
    groupAddressRatio: number;
    consecutiveGroupAddress: number;
  };
}

interface ProcessingState {
  status: 'idle' | 'preparing' | 'proofing' | 'synthesizing' | 'ready' | 'error';
  manifestId?: string;
  report?: LintReport;
  audioUrl?: string;
  downloadUrl?: string;
  error?: string;
  progress?: string;
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

export default function Home() {
  const [text, setText] = useState('');
  const [state, setState] = useState<ProcessingState>({ status: 'idle' });
  const [showReport, setShowReport] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editableOutput, setEditableOutput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Set audio source when URL is available
  useEffect(() => {
    if (audioRef.current && state.audioUrl) {
      audioRef.current.src = state.audioUrl;
    }
  }, [state.audioUrl]);

  /**
   * Handles file upload for text input
   */
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('text') && !file.name.endsWith('.md')) {
      setState({ status: 'error', error: 'Please upload a text or markdown file.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setText(content);
      setState({ status: 'idle' });
    };
    reader.onerror = () => {
      setState({ status: 'error', error: 'Failed to read file.' });
    };
    reader.readAsText(file);
  };

  /**
   * Processes text through the V3 preparation pipeline
   */
  const prepareText = async (inputText?: string): Promise<{ 
    manifestId: string; 
    report: LintReport; 
    processing?: ProcessingState['processing'] 
  } | null> => {
    const textToProcess = inputText || text;
    
    try {
      console.log('🚀 Starting V3 text preparation');
      console.log('📝 Input text preview:', textToProcess.substring(0, 100) + '...');
      
      const response = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToProcess,
          output: 'text',
          preset: 'angela',
          processingMode: 'v3_optimized',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to prepare text');
      }

      const data = await response.json();
      console.log('✅ V3 text preparation complete:', {
        manifestId: data.manifestId,
        hasAudioTags: (data.processing?.finalOutput || data.processing?.finalText || '').includes('['),
        finalTextPreview: (data.processing?.finalOutput || data.processing?.finalText || 'No processed text found').substring(0, 150) + '...',
        audioTags: data.processing?.audioTags || [],
      });
      
      // Update editable output only if it's not already set (first time processing)
      if (data.processing?.finalOutput && !editableOutput) {
        setEditableOutput(data.processing.finalOutput);
      }
      
      return { 
        manifestId: data.manifestId, 
        report: data.report,
        processing: data.processing 
      };
    } catch (error) {
      console.error('V3 preparation error:', error);
      setState({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  };

  /**
   * Synthesizes audio from prepared manifest
   */
  const synthesizeAudio = async (manifestId: string) => {
    try {
      console.log('🎵 Starting audio synthesis for manifest:', manifestId);
      
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestId,
          format: 'mp3_44100_128',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to synthesize audio');
      }

      const data = await response.json();
      return {
        audioUrl: data.url,
        downloadUrl: data.downloadUrl,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error('Synthesis error:', error);
      return null;
    }
  };

  /**
   * Synthesizes audio directly from edited text (bypasses processing)
   */
  const synthesizeEditedText = async (editedText: string) => {
    try {
      console.log('🎯 Direct synthesis from edited text');
      console.log('📝 Text preview:', editedText.substring(0, 100) + '...');
      
      // Create a minimal manifest directly from edited text
      const response = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editedText,
          output: 'text',
          preset: 'angela',
          processingMode: 'direct', // New mode that skips all processing
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to prepare edited text');
      }

      const data = await response.json();
      console.log('✅ Direct preparation complete for edited text');
      
      // Now synthesize using the manifest
      return await synthesizeAudio(data.manifestId);
    } catch (error) {
      console.error('Direct synthesis error:', error);
      return null;
    }
  };

  /**
   * Generates audio from text (using edited output if available)
   */
  const generateAudio = async () => {
    const inputText = editableOutput || text;
    if (!inputText.trim()) return;

    // If user has edited the output, use it directly without reprocessing
    if (editableOutput && editableOutput.trim() !== text.trim()) {
      console.log('🎯 Using edited output directly (skipping reprocessing)');
      console.log('📝 Edited text preview:', editableOutput.substring(0, 100) + '...');
      
      setState({ status: 'synthesizing', progress: 'Generating audio from your edited text...' });
      
      // Send edited text directly to synthesis without processing
      const result = await synthesizeEditedText(editableOutput);
      if (!result) {
        setState({ status: 'error', error: 'Failed to generate audio from edited text.' });
        return;
      }

      setState({
        status: 'ready',
        audioUrl: result.audioUrl,
        downloadUrl: result.downloadUrl,
        metadata: result.metadata,
      });
      return;
    }

    // First time generation - process the original text
    setState({ status: 'preparing', progress: 'Preparing text with V3 processing...' });

    const prepared = await prepareText(inputText);
    if (!prepared) {
      return;
    }

    setState({ 
      status: 'synthesizing', 
      progress: 'Generating audio with ElevenLabs V3...',
      manifestId: prepared.manifestId,
      report: prepared.report,
      processing: prepared.processing,
    });

    const result = await synthesizeAudio(prepared.manifestId);
    if (!result) {
      setState({ status: 'error', error: 'Failed to generate audio.' });
      return;
    }

    setState({
      status: 'ready',
      manifestId: prepared.manifestId,
      report: prepared.report,
      processing: prepared.processing,
      audioUrl: result.audioUrl,
      downloadUrl: result.downloadUrl,
      metadata: result.metadata,
    });
  };

  /**
   * Plays the generated audio
   */
  const isProcessing = ['preparing', 'proofing', 'synthesizing'].includes(state.status);
  const hasAudio = state.status === 'ready' && state.audioUrl;
  const hasReport = state.report && (state.report.warnings.length > 0 || state.report.bans.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-200">
      <div className="min-h-screen backdrop-blur-sm bg-white/10">
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          {/* Header */}
          <header className="text-center mb-12">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6 tracking-tight">
              WHITE SOUL TAROT
            </h1>
            <h2 className="text-2xl font-medium text-purple-700 mb-4">
              An AI-native engine for mapping resonance, emotional rhythm, and symbolic logic
            </h2>
            <p className="text-lg text-purple-600/80 font-light">
              Reconstructed from pattern. Powered by intuition.
            </p>
          </header>

        {/* Main Content */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 mb-8">
          {/* Text Input Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-purple-700 mb-2">SYSTEM INPUT</h3>
                <p className="text-sm text-purple-600/70 font-light">What speaks, and how it&apos;s speaking</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium rounded-xl transition-all duration-200 border border-purple-200 hover:border-purple-300"
              >
                <Upload size={16} />
                Upload File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,text/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            
            <textarea
              id="script-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Each reading begins with a randomized card draw. What emerges is left entirely to the currents..."
              className="w-full h-64 p-6 border-2 border-purple-200 rounded-2xl resize-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white/60 backdrop-blur-sm text-purple-900 placeholder-purple-400 font-light text-lg leading-relaxed transition-all duration-200"
              disabled={isProcessing}
            />
            
            <div className="flex justify-between items-center mt-4 text-sm text-purple-500/70 font-light">
              <span>{text.length} characters</span>
              <span>Max: 20,000 characters</span>
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl">
              <div className="flex items-center gap-4">
                <Loader2 className="animate-spin text-purple-600" size={24} />
                <div>
                  <h4 className="text-lg font-semibold text-purple-800 mb-1">TRANSMITTING</h4>
                  <span className="text-purple-600 font-light">
                    {state.progress}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {state.status === 'error' && (
            <div className="mb-8 p-6 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl">
              <div className="flex items-center gap-4">
                <AlertCircle className="text-red-600" size={24} />
                <div>
                  <h4 className="text-lg font-semibold text-red-800 mb-1">TRANSMISSION ERROR</h4>
                  <span className="text-red-600 font-light">
                    {state.error}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Lint Report */}
          {hasReport && (
            <div className="mb-8">
              <button
                onClick={() => setShowReport(!showReport)}
                className="flex items-center gap-3 text-lg font-semibold text-purple-700 hover:text-purple-800 transition-colors"
              >
                <AlertCircle size={20} />
                SYMBOLIC ANALYSIS ({state.report!.warnings.length + state.report!.bans.length} patterns detected)
              </button>
              
              {showReport && (
                <div className="mt-6 p-6 bg-white/90 backdrop-blur-sm border-2 border-purple-300 rounded-2xl shadow-lg">
                  {state.report!.bans.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xl font-bold text-red-700 mb-3">⚠️ BANNED PHRASES DETECTED</h4>
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                        <ul className="space-y-2">
                          {state.report!.bans.map((ban, i) => (
                            <li key={i} className="text-red-800 font-medium text-base flex items-center gap-2">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                              {ban}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {state.report!.warnings.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xl font-bold text-amber-700 mb-3">💫 STYLE INSIGHTS</h4>
                      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                        <ul className="space-y-2">
                          {state.report!.warnings.map((warning, i) => (
                            <li key={i} className="text-amber-800 font-medium text-base flex items-center gap-2">
                              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t-2 border-purple-200">
                    <h5 className="text-lg font-bold text-purple-700 mb-4">📊 TRANSMISSION METRICS</h5>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <span className="text-purple-600 font-semibold text-sm block">WORDS</span>
                        <span className="text-purple-900 font-bold text-xl">{state.report!.stats.words}</span>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <span className="text-purple-600 font-semibold text-sm block">SENTENCES</span>
                        <span className="text-purple-900 font-bold text-xl">{state.report!.stats.sentences}</span>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <span className="text-purple-600 font-semibold text-sm block">GROUP ADDRESS</span>
                        <span className="text-purple-900 font-bold text-xl">{(state.report!.stats.groupAddressRatio * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <span className="text-purple-600 font-semibold text-sm block">CONSECUTIVE</span>
                        <span className="text-purple-900 font-bold text-xl">{state.report!.stats.consecutiveGroupAddress}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Editable Final Output */}
          {editableOutput && (
            <div className="mb-6 p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-2xl">
              <h3 className="text-lg font-semibold text-amber-800 mb-4">✏️ Final Output - Edit for Fine-Tuning</h3>
              
              {/* Quick Punctuation Reference */}
              <div className="mb-4 p-3 bg-white/70 rounded-lg border border-yellow-300">
                <h4 className="text-sm font-semibold text-amber-800 mb-2">⏱️ Complete Timing Reference</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-1 text-xs text-gray-700">
                  {/* Basic Punctuation */}
                  <span><code className="bg-gray-100 px-1 rounded">.</code> Period = natural end</span>
                  <span><code className="bg-gray-100 px-1 rounded">?</code> Question = ~0.7s pause</span>
                  <span><code className="bg-gray-100 px-1 rounded">,</code> Comma = micro pause</span>
                  
                  {/* Ellipses & Pauses */}
                  <span><code className="bg-gray-100 px-1 rounded">...</code> Ellipses = ~1.2s pause</span>
                  <span><code className="bg-gray-100 px-1 rounded">word...</code> After keywords = contemplative</span>
                  <span><code className="bg-gray-100 px-1 rounded">... Word</code> Before transitions = ~1.2s</span>
                  
                  {/* Em-dashes */}
                  <span><code className="bg-gray-100 px-1 rounded">—</code> Em-dash = ~1.8s shift</span>
                  <span><code className="bg-gray-100 px-1 rounded">——</code> Double em-dash = ~3.5s major shift</span>
                  <span><code className="bg-gray-100 px-1 rounded">— But</code> Emotional transitions</span>
                  
                  {/* Spacing & Paragraphs */}
                  <span><code className="bg-gray-100 px-1 rounded">  </code> Double space = natural pause</span>
                  <span><code className="bg-gray-100 px-1 rounded">\\n\\n</code> Paragraph = extended pause</span>
                  <span><code className="bg-gray-100 px-1 rounded">\\n\\n\\n</code> Scene change = major break</span>
                  
                  {/* Contextual Timing */}
                  <span><code className="bg-gray-100 px-1 rounded">card.</code> → <code className="bg-gray-100 px-1 rounded">card...</code> Auto-ellipses</span>
                  <span><code className="bg-gray-100 px-1 rounded">listen</code> → <code className="bg-gray-100 px-1 rounded">listen...</code> Attention cues</span>
                  <span><code className="bg-gray-100 px-1 rounded">think.</code> → <code className="bg-gray-100 px-1 rounded">think...</code> Reflection words</span>
                </div>
                <div className="mt-2 pt-2 border-t border-yellow-200">
                  <div className="mb-2">
                    <p className="text-xs font-medium text-amber-800 mb-1">Internal Pause System (Angela's Voice Config):</p>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-1 text-xs text-gray-600">
                      <span>Micro: 0.4s</span>
                      <span>Beat: 0.7s</span>
                      <span>Minor: 1.2s</span>
                      <span>Shift: 1.8s</span>
                      <span>Impact: 2.3s</span>
                      <span>Major: 3.5s</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 italic">
                    💡 V3 uses natural punctuation for pacing - these are automatically applied during processing
                  </p>
                </div>
              </div>

              {/* Available Audio Tags */}
              <div className="mb-4 p-3 bg-white/70 rounded-lg border border-yellow-300">
                <h4 className="text-sm font-semibold text-amber-800 mb-3">🎭 Click to Copy Audio Tags</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    // Breathing & Natural Sounds
                    { tag: '[sighs]', desc: 'Natural sigh' },
                    { tag: '[exhales]', desc: 'Breathing out' },
                    { tag: '[inhales]', desc: 'Breathing in' },
                    { tag: '[breathes deeply]', desc: 'Deep breath' },
                    { tag: '[coughs]', desc: 'Natural cough' },
                    
                    // Emotional Expressions
                    { tag: '[chuckles]', desc: 'Light laugh' },
                    { tag: '[sad]', desc: 'Melancholy tone' },
                    { tag: '[happy]', desc: 'Joyful energy' },
                    { tag: '[excited]', desc: 'High energy' },
                    { tag: '[amazed]', desc: 'Wonder' },
                    { tag: '[concerned]', desc: 'Gentle worry' },
                    { tag: '[worried]', desc: 'Anxious tone' },
                    { tag: '[thoughtful]', desc: 'Reflective wisdom' },
                    { tag: '[confident]', desc: 'Assured delivery' },
                    
                    // Mystical & Spiritual
                    { tag: '[mysterious]', desc: 'Mystical energy' },
                    { tag: '[mystical]', desc: 'Spiritual tone' },
                    { tag: '[curious]', desc: 'Wondering tone' },
                    { tag: '[intrigued]', desc: 'Deep interest' },
                    
                    // Delivery Styles
                    { tag: '[whispers]', desc: 'Soft whisper' },
                    { tag: '[slowly]', desc: 'Deliberate pace' },
                    { tag: '[emphasizes]', desc: 'Key insight' },
                    { tag: '[mischievously]', desc: 'Playful energy' }
                  ].map((item, index) => (
                    <button
                      key={index}
                      onClick={() => navigator.clipboard.writeText(item.tag)}
                      className="p-2 bg-white hover:bg-amber-50 border border-amber-200 hover:border-amber-300 rounded text-xs transition-colors duration-150 text-left"
                      title={`Click to copy: ${item.desc}`}
                    >
                      <code className="font-mono text-amber-800 font-semibold">{item.tag}</code>
                      <div className="text-gray-600 text-xs mt-1">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={editableOutput}
                onChange={(e) => setEditableOutput(e.target.value)}
                className="w-full h-80 p-4 border-2 border-yellow-200 rounded-lg resize-y focus:outline-none focus:border-yellow-400 text-gray-800 text-base leading-relaxed"
                placeholder="Your processed text will appear here for editing..."
              />
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-center mb-8">
            <button
              onClick={generateAudio}
              disabled={!(editableOutput || text).trim() || isProcessing}
              className="flex items-center gap-4 px-12 py-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold text-xl rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={28} className="animate-spin" />
                  PROCESSING...
                </>
              ) : (
                <>
                  <Play size={28} />
                  GENERATE ANGELA&apos;S VOICE
                </>
              )}
            </button>
          </div>

          {/* V3 Processing Info */}
          <div className="mb-8 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl text-center">
            <p className="text-sm text-purple-700">
              🚀 <strong>ElevenLabs V3 Optimized:</strong> Applies Angela&apos;s natural pacing rules (ellipses, em-dashes, hesitations) + contextual audio tags
            </p>
          </div>

          {/* Advanced Guide (Optional) */}
          <div className="mb-8">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center justify-center gap-3 w-full p-3 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200 rounded-lg transition-all duration-200"
            >
              <BookOpen size={20} className="text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                📖 Advanced Tips & Examples
              </span>
              {showGuide ? (
                <ChevronUp size={16} className="text-emerald-600" />
              ) : (
                <ChevronDown size={16} className="text-emerald-600" />
              )}
            </button>
            
            {showGuide && (
              <div className="mt-3 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                <div className="space-y-4">
                  <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                    <h5 className="font-semibold text-emerald-800 mb-2">💡 Pro Tips</h5>
                    <ul className="text-sm text-gray-800 space-y-1">
                      <li>• Start sentences with audio tags: <code className="bg-emerald-100 px-1 py-0.5 rounded text-xs">[sighs] This is complicated</code></li>
                      <li>• Use ellipses after key concepts: <code className="bg-emerald-100 px-1 py-0.5 rounded text-xs">&quot;isolation...&quot;</code></li>
                      <li>• Em-dashes for smooth transitions: <code className="bg-emerald-100 px-1 py-0.5 rounded text-xs">&quot;scattered — but here&apos;s the thing&quot;</code></li>
                      <li>• Let V3 handle natural speech - don&apos;t over-tag!</li>
                      <li>• Trust punctuation for pacing over excessive tags</li>
                    </ul>
                  </div>
                  
                  <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                    <h5 className="font-semibold text-emerald-800 mb-2">📝 Example Transformations</h5>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="font-medium text-gray-800 mb-1">Before:</div>
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800 border">&quot;The Hermit. This is different.&quot;</code>
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 mb-1">After:</div>
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800 border">&quot;[sighs] The Hermit... this one&apos;s different...&quot;</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Audio Player & Download */}
          {hasAudio && (
            <div className="p-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl">
              <div className="text-center mb-6">
                <h4 className="text-2xl font-bold text-green-800 mb-2">TRANSMISSION COMPLETE</h4>
                <p className="text-green-600 font-light">The system has spoken. What emerges is left entirely to the currents.</p>
              </div>
              
              <div className="flex items-center justify-center gap-6">
                {/* Full Audio Player */}
                <div className="w-full max-w-2xl mx-auto">
                  <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl shadow-lg">
                    <h3 className="text-xl font-bold text-emerald-800 mb-4 text-center">🎵 Angela&apos;s Voice Transmission</h3>
                    
                    <audio 
                      ref={audioRef} 
                      controls 
                      className="w-full h-12 rounded-lg shadow-md"
                      style={{
                        filter: 'sepia(20%) saturate(70%) hue-rotate(88deg) brightness(1.15) contrast(1.05)',
                      }}
                    >
                      <source src={state.downloadUrl} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                    
                    <div className="mt-4 flex items-center justify-between text-sm text-emerald-700">
                      <span>🎭 ElevenLabs v3 • Emotional Audio Tags</span>
                      <span>✨ White Soul Tarot</span>
                    </div>
                  </div>
                </div>
                
                {state.downloadUrl && (
                  <a
                    href={state.downloadUrl}
                    download={`white-soul-tarot-${state.manifestId}.mp3`}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <Download size={20} />
                    DOWNLOAD
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-purple-500/70 font-light">
          <p className="mb-2">White Soul Tarot is iterative, ambient, and evolving.</p>
          <p>Powered by ElevenLabs TTS • Angela Voice Styling • Vercel</p>
        </footer>
        </div>
      </div>
    </div>
  );
}