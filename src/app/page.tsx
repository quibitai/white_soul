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
  const synthesizeAudio = async (manifestId: string, isProof = false) => {
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

    const result = await synthesizeAudio(prepared.manifestId, true);
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

    const result = await synthesizeAudio(prepared.manifestId, false);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            White Soul Tarot
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Script → Styled Voice (Angela)
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Transform your tarot scripts into natural, engaging audio with AI-powered voice styling
          </p>
        </header>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          {/* Text Input Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <label htmlFor="script-input" className="text-lg font-semibold text-gray-900 dark:text-white">
                Your Script
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
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
              placeholder="Paste your tarot script here, or upload a text file..."
              className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              disabled={isProcessing}
            />
            
            <div className="flex justify-between items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{text.length} characters</span>
              <span>Max: 20,000 characters</span>
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-blue-600" size={20} />
                <span className="text-blue-800 dark:text-blue-200 font-medium">
                  {state.progress}
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {state.status === 'error' && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-600" size={20} />
                <span className="text-red-800 dark:text-red-200 font-medium">
                  {state.error}
                </span>
              </div>
            </div>
          )}

          {/* Lint Report */}
          {hasReport && (
            <div className="mb-6">
              <button
                onClick={() => setShowReport(!showReport)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                <AlertCircle size={16} />
                Style Report ({state.report!.warnings.length + state.report!.bans.length} issues)
              </button>
              
              {showReport && (
                <div className="mt-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
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
          <div className="flex gap-4 mb-6">
            <button
              onClick={generateProof}
              disabled={!text.trim() || isProcessing}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <Play size={18} />
              Generate 30s Proof
            </button>
            
            <button
              onClick={generateFull}
              disabled={!text.trim() || isProcessing}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <CheckCircle size={18} />
              Generate Full Audio
            </button>
          </div>

          {/* Audio Player & Download */}
          {hasAudio && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={playAudio}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                  >
                    <Play size={16} />
                    Play Audio
                  </button>
                  
                  <audio ref={audioRef} controls className="hidden" />
                </div>
                
                {state.downloadUrl && (
                  <a
                    href={state.downloadUrl}
                    download={`white-soul-tarot-${state.manifestId}.mp3`}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    <Download size={16} />
                    Download
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Powered by ElevenLabs TTS • Angela Voice Styling • Vercel</p>
        </footer>
      </div>
    </div>
  );
}