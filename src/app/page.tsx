/**
 * Main page component for White Soul Tarot TTS application
 * Provides interface for text input, processing, and audio generation
 * using Angela voice styling with ElevenLabs TTS.
 */

'use client';

import { useState, useRef } from 'react';
import { Upload, Play, Download, AlertCircle, CheckCircle, Loader2, Code } from 'lucide-react';

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
  const [showProcessing, setShowProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
   * Processes text through the preparation pipeline
   */
  const prepareText = async (): Promise<{ 
    manifestId: string; 
    report: LintReport; 
    processing?: ProcessingState['processing'] 
  } | null> => {
    try {
      const response = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          output: 'ssml',
          preset: 'angela',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to prepare text');
      }

      const data = await response.json();
      return { 
        manifestId: data.manifestId, 
        report: data.report,
        processing: data.processing 
      };
    } catch (error) {
      console.error('Preparation error:', error);
      return null;
    }
  };

  /**
   * Synthesizes audio from prepared manifest
   */
  const synthesizeAudio = async (manifestId: string) => {
    try {
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
   * Generates 30-second proof audio
   */
  const generateProof = async () => {
    if (!text.trim()) return;

    setState({ status: 'preparing', progress: 'Preparing text...' });

    const prepared = await prepareText();
    if (!prepared) {
      setState({ status: 'error', error: 'Failed to prepare text for synthesis.' });
      return;
    }

    setState({ 
      status: 'proofing', 
      progress: 'Generating proof audio...',
      manifestId: prepared.manifestId,
      report: prepared.report,
      processing: prepared.processing,
    });

    const result = await synthesizeAudio(prepared.manifestId);
    if (!result) {
      setState({ status: 'error', error: 'Failed to generate proof audio.' });
      return;
    }

    setState({
      status: 'ready',
      manifestId: prepared.manifestId,
      report: prepared.report,
      audioUrl: result.audioUrl,
      downloadUrl: result.downloadUrl,
    });
  };

  /**
   * Generates full audio
   */
  const generateFull = async () => {
    if (!text.trim()) return;

    setState({ status: 'preparing', progress: 'Preparing text...' });

    const prepared = await prepareText();
    if (!prepared) {
      setState({ status: 'error', error: 'Failed to prepare text for synthesis.' });
      return;
    }

    setState({ 
      status: 'synthesizing', 
      progress: 'Generating full audio...',
      manifestId: prepared.manifestId,
      report: prepared.report,
      processing: prepared.processing,
    });

    const result = await synthesizeAudio(prepared.manifestId);
    if (!result) {
      setState({ status: 'error', error: 'Failed to generate full audio.' });
      return;
    }

    setState({
      status: 'ready',
      manifestId: prepared.manifestId,
      report: prepared.report,
      audioUrl: result.audioUrl,
      downloadUrl: result.downloadUrl,
    });
  };

  /**
   * Plays the generated audio
   */
  const playAudio = () => {
    if (audioRef.current && state.audioUrl) {
      audioRef.current.src = state.audioUrl;
      audioRef.current.play();
    }
  };

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

          {/* Processing Annotations */}
          {state.processing && (
            <div className="mb-8">
              <button
                onClick={() => setShowProcessing(!showProcessing)}
                className="flex items-center gap-3 text-lg font-semibold text-indigo-700 hover:text-indigo-800 transition-colors"
              >
                <Code size={20} />
                PROCESSING PIPELINE (ElevenLabs Output)
              </button>
              
              {showProcessing && (
                <div className="mt-6 space-y-6">
                  {/* Pipeline Steps */}
                  <div className="p-6 bg-indigo-50 border-2 border-indigo-200 rounded-2xl">
                    <h4 className="text-xl font-bold text-indigo-800 mb-4">🔄 PROCESSING STEPS</h4>
                    <div className="space-y-3">
                      {state.processing.pipeline.map((step, index) => (
                        <div key={step.step} className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-indigo-800 capitalize">{step.step}</span>
                            <p className="text-indigo-600 text-sm">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Text Transformations */}
                  <div className="grid gap-4">
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h5 className="font-bold text-gray-800 mb-2">📝 ORIGINAL TEXT</h5>
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white p-3 rounded border overflow-x-auto">
                        {state.processing.originalText}
                      </pre>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="font-bold text-blue-800 mb-2">🔧 AFTER MACROS</h5>
                      <pre className="text-sm text-blue-700 whitespace-pre-wrap font-mono bg-white p-3 rounded border overflow-x-auto">
                        {state.processing.withMacros}
                      </pre>
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h5 className="font-bold text-green-800 mb-2">💬 AFTER CONVERSATIONAL</h5>
                      <pre className="text-sm text-green-700 whitespace-pre-wrap font-mono bg-white p-3 rounded border overflow-x-auto">
                        {state.processing.conversational}
                      </pre>
                    </div>

                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <h5 className="font-bold text-purple-800 mb-2">🎭 AFTER WST2 RULES</h5>
                      <pre className="text-sm text-purple-700 whitespace-pre-wrap font-mono bg-white p-3 rounded border overflow-x-auto">
                        {state.processing.wst2Formatted}
                      </pre>
                    </div>

                    <div className="p-4 bg-orange-50 border-2 border-orange-400 rounded-lg">
                      <h5 className="font-bold text-orange-800 mb-2">🎯 FINAL OUTPUT (Sent to ElevenLabs)</h5>
                      <pre className="text-sm text-orange-700 whitespace-pre-wrap font-mono bg-white p-3 rounded border overflow-x-auto">
                        {state.processing.finalOutput}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-6 mb-8">
            <button
              onClick={generateProof}
              disabled={!text.trim() || isProcessing}
              className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Play size={20} />
              GENERATE PROOF
            </button>
            
            <button
              onClick={generateFull}
              disabled={!text.trim() || isProcessing}
              className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <CheckCircle size={20} />
              FULL TRANSMISSION
            </button>
          </div>

          {/* Audio Player & Download */}
          {hasAudio && (
            <div className="p-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl">
              <div className="text-center mb-6">
                <h4 className="text-2xl font-bold text-green-800 mb-2">TRANSMISSION COMPLETE</h4>
                <p className="text-green-600 font-light">The system has spoken. What emerges is left entirely to the currents.</p>
              </div>
              
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={playAudio}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Play size={20} />
                  PLAY TRANSMISSION
                </button>
                
                <audio ref={audioRef} controls className="hidden" />
                
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