/**
 * Dev Plan 02 Implementation - Advanced TTS Pipeline
 * Complete blob-only architecture with content-addressable caching
 */

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
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
  ssmlContent?: string;
}

export default function V2Page() {
  const [script, setScript] = useState('');
  const [settings, setSettings] = useState<TuningSettings>(DEFAULT_TUNING_SETTINGS);
  const [showTuning, setShowTuning] = useState(true);
  const [currentJob, setCurrentJob] = useState<RenderJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedSSML, setEditedSSML] = useState<string | null>(null);

  // Poll for status updates
  useEffect(() => {
    if (!currentJob || currentJob.status.state === 'done' || currentJob.status.state === 'failed') {
      console.log('🛑 Stopping polling - job state:', currentJob?.status.state);
      return;
    }
    
    console.log('🔄 Starting polling for job:', currentJob.renderId, 'state:', currentJob.status.state);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/status/${currentJob.renderId}`);
        if (response.ok) {
          const data = await response.json();
          console.log('📊 Status update received:', data.state, 'finalUrl:', !!data.finalUrl);
          
          // Update job with status, finalUrl, diagnostics, and ssmlContent
          setCurrentJob(prev => prev ? { 
            ...prev, 
            status: data,
            finalUrl: data.finalUrl,
            diagnostics: data.diagnostics,
            ssmlContent: data.ssmlContent
          } : null);

          // If completed or failed, stop polling
          if (data.state === 'done') {
            console.log('🏁 Job completed, stopping polling:', data.state);
            clearInterval(pollInterval);
          } else if (data.state === 'failed') {
            console.log('❌ Job failed, stopping polling:', data.state);
            clearInterval(pollInterval);
          }
        } else {
          console.warn('❌ Status API error:', response.status, response.statusText);
          if (response.status === 404) {
            console.log('🔍 Status not found, job may have completed - stopping polling');
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
    setEditedSSML(null); // Reset edited SSML

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

      // Processing starts automatically in startRender action
      console.log('🔄 Processing started automatically');

    } catch (error) {
      console.error('❌ Render failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerateFromSSML = async () => {
    if (!editedSSML || !currentJob) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('🔄 Regenerating from edited SSML...');
      
      // Create a new render with the edited SSML as the raw script
      // The SSML will be re-processed through the annotation pipeline
      const result = await startRender({
        rawScript: editedSSML,
        settings,
      });
      console.log('✅ Regeneration started:', result);

      // Create new job state
      const newJob: RenderJob = {
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

      setCurrentJob(newJob);
      setEditedSSML(null); // Reset after regeneration

      console.log('🔄 Regeneration processing started automatically');

    } catch (error) {
      console.error('❌ Regeneration failed:', error);
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
      case 'queued': return 'text-blue-800 font-semibold';
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
      {/* Toyota Tercel Easter Egg Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => window.location.href = '/v2/tercel'}
          className="group relative bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-3 py-2 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 font-bold text-sm border-2 border-red-800 overflow-hidden"
          title="Toyota Tercel Mode - I love what you do for me!"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Image 
                src="/images/tercel.jpeg" 
                alt="Tercel" 
                width={24}
                height={16}
                className="object-cover rounded border border-red-300 group-hover:border-yellow-400 transition-colors"
              />
            </div>
            <span className="hidden sm:inline">I love what you do for me</span>
            <span className="sm:hidden">Tercel</span>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-xs px-1 rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity">
            &apos;90
          </div>
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>
      </div>
      
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            White Soul Tarot v2.0
          </h1>
          <p className="text-xl text-gray-800 mb-2 font-medium">
            Advanced TTS Pipeline with Content-Addressable Caching
          </p>
          <p className="text-sm text-gray-700">
            Blob-only architecture • Semantic chunking • Professional mastering
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-3 space-y-6">
            {/* Script Input */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Script Input</h2>
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
                className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 placeholder-gray-600"
                disabled={isProcessing}
              />

              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-800 font-medium">
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
                
                {/* Test Button for Debugging */}
                        <button
          onClick={async () => {
            try {
              const response = await fetch('/api/test-synthesis', { method: 'POST' });
              const result = await response.json();
              console.log('Test result:', result);
              alert(result.success ? 'Test successful!' : `Test failed: ${result.error}`);
            } catch (error) {
              console.error('Test error:', error);
              alert('Test failed - check console');
            }
          }}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-all duration-200"
        >
          Test API
        </button>
        
        <button
          onClick={async () => {
            try {
              const response = await fetch('/api/env-check');
              const result = await response.json();
              console.log('Environment check:', result);
              
              const status = result.configured ? '✅ CONFIGURED' : '❌ MISSING CONFIG';
              const details = `${status}\n\nRequired:\n- API Key: ${result.environment.elevenlabs.apiKey ? '✅' : '❌'}\n- Voice ID: ${result.environment.elevenlabs.voiceId ? '✅' : '❌'}\n\nModel: ${result.environment.elevenlabs.modelId}\nBypass Mode: ${result.environment.elevenlabs.bypassMode}`;
              
              alert(details);
            } catch (error) {
              console.error('Environment check error:', error);
              alert('Environment check failed - check console');
            }
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200"
        >
          Check Config
        </button>
        
        <button
          onClick={async () => {
            try {
              const response = await fetch('/api/test-process', { method: 'POST' });
              const result = await response.json();
              console.log('Process test result:', result);
              
              const status = result.success ? '✅ WORKING' : '❌ FAILED';
              const message = `API Process Test: ${status}\n\n${result.success ? 'Internal API calls are working!' : `Error: ${result.error}\nDetails: ${result.details}`}`;
              
              alert(message);
            } catch (error) {
              console.error('Process test error:', error);
              alert('Process test failed - check console');
            }
          }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all duration-200"
        >
          Test Process
        </button>
        
        <button
          onClick={async () => {
            try {
              const response = await fetch('/api/test-render', { method: 'POST' });
              const result = await response.json();
              console.log('Render test result:', result);
              
              const status = result.success ? '✅ WORKING' : '❌ FAILED';
              const message = `Render Function Test: ${status}\n\n${result.success ? 'processRender function is working!' : `Error: ${result.error}\nDetails: ${result.details}`}`;
              
              alert(message);
            } catch (error) {
              console.error('Render test error:', error);
              alert('Render test failed - check console');
            }
          }}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-200"
        >
          Test Render
        </button>
        
        <button
          onClick={async () => {
            if (confirm('Enable bypass mode? This will use dummy audio instead of ElevenLabs.')) {
              try {
                const response = await fetch('/api/set-bypass', { 
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ enabled: true })
                });
                const result = await response.json();
                alert(result.success ? 'Bypass mode enabled!' : `Failed: ${result.error}`);
              } catch (error) {
                console.error('Bypass error:', error);
                alert('Failed to enable bypass mode');
              }
            }
          }}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-all duration-200"
        >
          Enable Bypass
        </button>
              </div>
            </div>

                      {/* SSML Preview */}
          {currentJob?.ssmlContent && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Annotated Script (SSML)</h3>
                <button
                  onClick={handleRegenerateFromSSML}
                  disabled={isProcessing || !editedSSML || editedSSML === currentJob.ssmlContent}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Zap size={16} />
                  <span>Regenerate Audio</span>
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <textarea
                  value={editedSSML || currentJob.ssmlContent}
                  onChange={(e) => setEditedSSML(e.target.value)}
                  className="w-full h-64 text-sm text-gray-700 font-mono bg-transparent border-none resize-none focus:outline-none"
                  placeholder="Edit SSML content here..."
                />
              </div>
              {editedSSML && editedSSML !== currentJob.ssmlContent && (
                <div className="mt-2 text-sm text-orange-600 flex items-center space-x-1">
                  <AlertCircle size={14} />
                  <span>SSML has been modified. Click &quot;Regenerate Audio&quot; to apply changes.</span>
                </div>
              )}
            </div>
          )}

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
                  <div className="flex justify-between text-sm text-gray-900 font-medium mb-2">
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
                        <span className="font-semibold text-gray-900 capitalize">{step.name}</span>
                      </div>
                      {step.total && (
                        <span className="text-sm text-gray-900 font-medium">
                          {step.done || 0} / {step.total}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Render Info */}
                {currentJob.result && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">Render Information</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-900 font-medium">Chunks:</span>
                        <span className="ml-2 font-semibold text-gray-900">{currentJob.result.stats.chunks}</span>
                      </div>
                      <div>
                        <span className="text-gray-900 font-medium">Duration:</span>
                        <span className="ml-2 font-semibold text-gray-900">{currentJob.result.stats.estimatedDuration}s</span>
                      </div>
                      <div>
                        <span className="text-gray-900 font-medium">SSML Tags:</span>
                        <span className="ml-2 font-semibold text-gray-900">{currentJob.result.stats.ssmlTags}</span>
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
                        <span className="text-gray-900 font-medium">WPM:</span>
                        <span className="ml-2 font-semibold text-gray-900">{currentJob.diagnostics.wpm}</span>
                      </div>
                      <div>
                        <span className="text-gray-900 font-medium">Duration:</span>
                        <span className="ml-2 font-semibold text-gray-900">{Number(currentJob.diagnostics.durationSec).toFixed(2)}s</span>
                      </div>
                      <div>
                        <span className="text-gray-900 font-medium">LUFS:</span>
                        <span className="ml-2 font-semibold text-gray-900">{Number(currentJob.diagnostics.lufsIntegrated).toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-gray-900 font-medium">True Peak:</span>
                        <span className="ml-2 font-semibold text-gray-900">{Number(currentJob.diagnostics.truePeakDb).toFixed(1)} dB</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tuning Panel */}
          <div className="xl:col-span-2">
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
