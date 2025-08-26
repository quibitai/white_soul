/**
 * Main page component for White Soul Tarot TTS application
 * Provides interface for text input, processing, and audio generation
 * using Angela voice styling with ElevenLabs TTS.
 */

'use client';

import { useState, useRef } from 'react';
import { Upload, Play, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

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
}

export default function Home() {
  const [text, setText] = useState('');
  const [state, setState] = useState<ProcessingState>({ status: 'idle' });
  const [showReport, setShowReport] = useState(false);
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
  const prepareText = async (): Promise<{ manifestId: string; report: LintReport } | null> => {
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
      return { manifestId: data.manifestId, report: data.report };
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
                <div className="mt-6 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-2xl">
                  {state.report!.bans.length > 0 && (
                    <div className="mb-3">
                      <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Banned Phrases:</h4>
                      <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
                        {state.report!.bans.map((ban, i) => (
                          <li key={i}>{ban}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {state.report!.warnings.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Warnings:</h4>
                      <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300">
                        {state.report!.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Words:</span> {state.report!.stats.words}
                      </div>
                      <div>
                        <span className="font-medium">Sentences:</span> {state.report!.stats.sentences}
                      </div>
                      <div>
                        <span className="font-medium">Group Address:</span> {(state.report!.stats.groupAddressRatio * 100).toFixed(1)}%
                      </div>
                      <div>
                        <span className="font-medium">Consecutive:</span> {state.report!.stats.consecutiveGroupAddress}
                      </div>
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