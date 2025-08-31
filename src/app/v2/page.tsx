/**
 * Dev Plan 02 Implementation - Advanced TTS Pipeline
 * Complete blob-only architecture with content-addressable caching
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  Settings, 
  AlertCircle, 
  Loader2, 
  CheckCircle,
  Clock,
  Zap,
  BarChart3,
} from 'lucide-react';
import TuningPanel from '@/components/TuningPanel';
import { 
  TuningSettings, 
  DEFAULT_TUNING_SETTINGS,
  type RenderStatus,
  type Diagnostics,
} from '@/lib/types/tuning';
import { startRender, type StartRenderResult } from '@/app/actions/startRender';

interface RenderJob {
  renderId: string;
  status: RenderStatus;
  result?: StartRenderResult;
  finalUrl?: string;
  diagnostics?: Diagnostics;
}

export default function V2Page() {
  const [script, setScript] = useState('');
  const [settings, setSettings] = useState<TuningSettings>(DEFAULT_TUNING_SETTINGS);
  const [showTuning, setShowTuning] = useState(false);
  const [currentJob, setCurrentJob] = useState<RenderJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for status updates
  useEffect(() => {
    if (!currentJob || currentJob.status.state === 'done' || currentJob.status.state === 'failed') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/status/${currentJob.renderId}`);
        if (response.ok) {
          const status: RenderStatus = await response.json();
          setCurrentJob(prev => prev ? { ...prev, status } : null);

          // If completed, fetch final result
          if (status.state === 'done') {
            // TODO: Fetch final URL and diagnostics
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Failed to poll status:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentJob]);

  const handleStartRender = async () => {
    if (!script.trim()) {
      setError('Please enter a script to process');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentJob(null);

    try {
      console.log('🚀 Starting render with dev_plan_02 architecture');
      
      // Start the render job
      const result = await startRender({
        rawScript: script,
        settings,
      });

      console.log('✅ Render started:', result);

      // Create initial job state
      const initialJob: RenderJob = {
        renderId: result.renderId,
        status: {
          state: 'queued',
          progress: { total: result.stats.chunks, done: 0 },
          steps: [
            { name: 'ssml', ok: true },
            { name: 'chunk', ok: true },
            { name: 'synthesize', ok: false, done: 0, total: result.stats.chunks },
          ],
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          error: null,
        },
        result,
      };

      setCurrentJob(initialJob);

      // Start processing
      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renderId: result.renderId }),
      });

      if (!processResponse.ok) {
        throw new Error('Failed to start processing');
      }

      console.log('🔄 Processing started');

    } catch (error) {
      console.error('❌ Render failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_TUNING_SETTINGS);
  };

  const savePreset = (name: string) => {
    // TODO: Implement preset saving to blob storage
    console.log('Saving preset:', name, settings);
  };

  const getProgressPercentage = () => {
    if (!currentJob) return 0;
    const { total, done } = currentJob.status.progress;
    return total > 0 ? (done / total) * 100 : 0;
  };

  const getStatusColor = (state: RenderStatus['state']) => {
    switch (state) {
      case 'queued': return 'text-blue-600';
      case 'running': return 'text-yellow-600';
      case 'done': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (state: RenderStatus['state']) => {
    switch (state) {
      case 'queued': return <Clock size={20} />;
      case 'running': return <Loader2 size={20} className="animate-spin" />;
      case 'done': return <CheckCircle size={20} />;
      case 'failed': return <AlertCircle size={20} />;
      default: return <Clock size={20} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            White Soul Tarot v2.0
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Advanced TTS Pipeline with Content-Addressable Caching
          </p>
          <p className="text-sm text-gray-500">
            Blob-only architecture • Semantic chunking • Professional mastering
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Script Input */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Script Input</h2>
                <button
                  onClick={() => setShowTuning(!showTuning)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    showTuning 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Settings size={18} />
                  <span>Tuning</span>
                </button>
              </div>

              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Enter your tarot reading script here..."
                className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={isProcessing}
              />

              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-500">
                  {script.length} / 50,000 characters
                </span>
                <button
                  onClick={handleStartRender}
                  disabled={!script.trim() || isProcessing}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      <span>Generate Audio</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle size={20} className="text-red-600" />
                  <span className="text-red-800 font-medium">Error</span>
                </div>
                <p className="text-red-700 mt-2">{error}</p>
              </div>
            )}

            {/* Render Progress */}
            {currentJob && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Render Progress</h3>
                  <div className={`flex items-center space-x-2 ${getStatusColor(currentJob.status.state)}`}>
                    {getStatusIcon(currentJob.status.state)}
                    <span className="font-medium capitalize">{currentJob.status.state}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Overall Progress</span>
                    <span>{Math.round(getProgressPercentage())}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  {currentJob.status.steps.map((step, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        {step.ok ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <Clock size={16} className="text-gray-400" />
                        )}
                        <span className="font-medium capitalize">{step.name}</span>
                      </div>
                      {step.total && (
                        <span className="text-sm text-gray-600">
                          {step.done || 0} / {step.total}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Render Info */}
                {currentJob.result && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Render Information</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-blue-600">Chunks:</span>
                        <span className="ml-2 font-medium">{currentJob.result.stats.chunks}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Duration:</span>
                        <span className="ml-2 font-medium">{currentJob.result.stats.estimatedDuration}s</span>
                      </div>
                      <div>
                        <span className="text-blue-600">SSML Tags:</span>
                        <span className="ml-2 font-medium">{currentJob.result.stats.ssmlTags}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error */}
                {currentJob.status.error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Error Details</h4>
                    <p className="text-red-700 text-sm">{currentJob.status.error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Audio Player */}
            {currentJob?.finalUrl && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Generated Audio</h3>
                  <a
                    href={currentJob.finalUrl}
                    download={`render-${currentJob.renderId}.mp3`}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Download size={18} />
                    <span>Download</span>
                  </a>
                </div>

                <audio 
                  controls 
                  src={currentJob.finalUrl}
                  className="w-full"
                >
                  Your browser does not support the audio element.
                </audio>

                {/* Diagnostics */}
                {currentJob.diagnostics && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-3 flex items-center space-x-2">
                      <BarChart3 size={18} />
                      <span>Audio Diagnostics</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">WPM:</span>
                        <span className="ml-2 font-medium">{currentJob.diagnostics.wpm}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-medium">{currentJob.diagnostics.durationSec}s</span>
                      </div>
                      <div>
                        <span className="text-gray-600">LUFS:</span>
                        <span className="ml-2 font-medium">{currentJob.diagnostics.lufsIntegrated}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">True Peak:</span>
                        <span className="ml-2 font-medium">{currentJob.diagnostics.truePeakDb} dB</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tuning Panel */}
          <div className="lg:col-span-1">
            {showTuning && (
              <TuningPanel
                settings={settings}
                onChange={setSettings}
                onReset={resetSettings}
                onSavePreset={savePreset}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
