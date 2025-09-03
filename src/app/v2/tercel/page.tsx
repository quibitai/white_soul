/**
 * Toyota Tercel 1990 Retro Mode - "I love what you do for me!"
 * A fun 80s-themed version of the TTS app inspired by classic car advertisements
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Download, 
  Settings, 
  AlertCircle, 
  Loader2, 
  CheckCircle,
  Clock,
  Zap,
  BarChart3,
  ArrowLeft,
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

export default function TercelPage() {
  const [script, setScript] = useState('');
  const [settings, setSettings] = useState<TuningSettings>(DEFAULT_TUNING_SETTINGS);
  const [showTuning, setShowTuning] = useState(true);
  const [currentJob, setCurrentJob] = useState<RenderJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedSSML, setEditedSSML] = useState<string | null>(null);

  // Poll for status updates (same logic as main page)
  useEffect(() => {
    if (!currentJob || currentJob.status.state === 'done' || currentJob.status.state === 'failed') {
      console.log('🛑 Stopping polling - job state:', currentJob?.status.state);
      return;
    }

    console.log('🔄 Starting status polling for job:', currentJob.renderId);
    
    const pollInterval = setInterval(async () => {
      try {
        console.log('📡 Polling status for job:', currentJob.renderId);
        const response = await fetch(`/api/status/${currentJob.renderId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log('❌ Status not found (404) - job may have timed out');
            setError('Job timed out or failed to start. Please try again.');
            setCurrentJob(null);
            setIsProcessing(false);
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const status: RenderStatus = await response.json();
        console.log('📊 Status update:', status);
        
        setCurrentJob(prev => prev ? { ...prev, status } : null);

        // Handle completion
        if (status.state === 'done' && status.finalUrl) {
          console.log('✅ Job completed with final URL:', status.finalUrl);
          setCurrentJob(prev => prev ? { ...prev, finalUrl: status.finalUrl } : null);
          setIsProcessing(false);
        } else if (status.state === 'failed') {
          console.log('❌ Job failed:', status.error);
          setError(status.error || 'Processing failed');
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
        setError('Failed to check job status');
        setCurrentJob(null);
        setIsProcessing(false);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentJob?.renderId, currentJob?.status.state]);

  const handleGenerate = async () => {
    if (!script.trim()) {
      setError('Please enter some text to convert');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setCurrentJob(null);

    try {
      console.log('🚀 Starting render with script length:', script.length);
      const result = await startRender({
        rawScript: script,
        settings,
      });

      console.log('✅ Render started:', result);

      // Initialize job tracking
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
    } catch (error) {
      console.error('❌ Failed to start render:', error);
      setError(error instanceof Error ? error.message : 'Failed to start processing');
      setIsProcessing(false);
    }
  };

  const handleTestAPI = async () => {
    try {
      const response = await fetch('/api/test-synthesis', { method: 'POST' });
      const result = await response.json();
      console.log('Test result:', result);
      alert(result.success ? 'Totally radical! API test successful!' : `Bummer, dude: ${result.error}`);
    } catch (error) {
      console.error('Test error:', error);
      alert('Test failed - check console, man!');
    }
  };

  const handleEnableBypass = async () => {
    try {
      const response = await fetch('/api/set-bypass', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });
      const result = await response.json();
      console.log('Bypass result:', result);
      alert('Bypass mode activated! Set BYPASS_ELEVENLABS=true in Vercel environment variables to use dummy audio.');
    } catch (error) {
      console.error('Bypass error:', error);
      alert('Failed to enable bypass mode');
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'queued': return <Clock size={20} className="text-yellow-400" />;
      case 'running': return <Loader2 size={20} className="animate-spin text-cyan-400" />;
      case 'done': return <CheckCircle size={20} className="text-green-400" />;
      case 'failed': return <AlertCircle size={20} className="text-red-400" />;
      default: return <Clock size={20} className="text-yellow-400" />;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Tercel Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/images/tercel.jpeg')`,
        }}
      />
      
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60" />
      
      {/* 80s Grid Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(cyan 1px, transparent 1px),
            linear-gradient(90deg, cyan 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Retro Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="h-full w-full" style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, cyan 2px, cyan 4px)'
        }} />
      </div>



      {/* Back Button */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => window.location.href = '/v2'}
          className="group bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 font-bold text-sm border-2 border-cyan-400"
        >
          <div className="flex items-center gap-2">
            <ArrowLeft size={16} />
            <span>Back to Future</span>
          </div>
        </button>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-6xl relative z-10">
        {/* Retro Header */}
        <header className="text-center mb-12">
          <div className="mb-6">
            <div className="text-6xl mb-4">🚗</div>
            <h1 className="text-6xl font-bold text-transparent bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-400 bg-clip-text mb-4 font-mono tracking-wider">
              WHITE SOUL TERCEL
            </h1>
            <div className="text-2xl text-cyan-300 mb-4 font-bold italic">
              "When it comes to TTS, it's beautiful."
            </div>
          </div>
          
          <div className="bg-black/50 border-2 border-cyan-400 rounded-lg p-6 max-w-4xl mx-auto backdrop-blur-sm">
            <p className="text-lg text-white mb-4 leading-relaxed">
              Most people subscribe to the theory that the better a TTS engine looks, the more it costs. 
              Thankfully, <span className="text-cyan-400 font-bold">White Soul</span> doesn't.
            </p>
            <p className="text-sm text-cyan-200 leading-relaxed">
              A perfect example is the 1990 Tercel TTS. Not only is the Tercel great-sounding, it makes 
              great sense too. In addition to being White Soul's lowest-priced engine, Tercel offers a 
              <span className="text-pink-400 font-bold">12-valve powertrain</span> that is among White Soul's most 
              economical and <span className="text-yellow-400 font-bold">fuel-efficient*</span> engines.
            </p>
            <div className="text-2xl text-pink-400 font-bold italic mt-6">
              "White Soul, I love what you do for me"
            </div>
          </div>
        </header>



        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-3 space-y-8">
            {/* Script Input - Retro Style */}
            <div className="bg-black/70 border-2 border-cyan-400 rounded-lg p-6 backdrop-blur-sm">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4 font-mono">
                📼 SCRIPT INPUT TERMINAL
              </h2>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Enter your totally radical script here, dude..."
                className="w-full h-48 p-4 bg-black/80 border-2 border-cyan-600 rounded text-green-400 font-mono text-sm focus:border-pink-400 focus:outline-none resize-none"
                style={{ fontFamily: 'Courier New, monospace' }}
              />
              <div className="mt-4 text-cyan-300 text-sm font-mono">
                CHARACTERS: {script.length} | STATUS: {script.length > 0 ? 'READY' : 'WAITING FOR INPUT'}
              </div>
            </div>

            {/* Control Panel - Retro Style */}
            <div className="bg-black/70 border-2 border-pink-400 rounded-lg p-6 backdrop-blur-sm">
              <h3 className="text-xl font-bold text-pink-400 mb-4 font-mono">
                🎛️ MISSION CONTROL
              </h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing || !script.trim()}
                  className="bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-lg transform hover:scale-105 transition-all duration-300 border-2 border-pink-300 disabled:border-gray-500"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={20} className="animate-spin" />
                      <span>PROCESSING...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap size={20} />
                      <span>GENERATE AUDIO</span>
                    </div>
                  )}
                </button>

                <button
                  onClick={handleTestAPI}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-4 py-3 rounded-lg font-bold shadow-lg transform hover:scale-105 transition-all duration-300 border-2 border-cyan-300"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={16} />
                    <span>TEST API</span>
                  </div>
                </button>

                <button
                  onClick={handleEnableBypass}
                  className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white px-4 py-3 rounded-lg font-bold shadow-lg transform hover:scale-105 transition-all duration-300 border-2 border-yellow-300"
                >
                  <div className="flex items-center gap-2">
                    <Settings size={16} />
                    <span>BYPASS MODE</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Status Display - Retro Style */}
            {(currentJob || error) && (
              <div className="bg-black/70 border-2 border-yellow-400 rounded-lg p-6 backdrop-blur-sm">
                <h3 className="text-xl font-bold text-yellow-400 mb-4 font-mono">
                  📊 SYSTEM STATUS
                </h3>
                
                {error && (
                  <div className="bg-red-900/50 border border-red-400 rounded p-4 mb-4">
                    <div className="flex items-center gap-2 text-red-400 font-bold">
                      <AlertCircle size={20} />
                      <span>ERROR DETECTED</span>
                    </div>
                    <p className="text-red-300 mt-2 font-mono">{error}</p>
                  </div>
                )}

                {currentJob && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(currentJob.status.state)}
                      <span className="text-cyan-400 font-bold font-mono">
                        STATUS: {currentJob.status.state.toUpperCase()}
                      </span>
                    </div>

                    {/* Progress Bar - Retro Style */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-cyan-300 font-mono">
                        <span>PROGRESS</span>
                        <span>{currentJob.status.progress.done}/{currentJob.status.progress.total}</span>
                      </div>
                      <div className="w-full bg-black/50 border border-cyan-600 rounded-full h-4">
                        <div
                          className="bg-gradient-to-r from-cyan-400 to-pink-400 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(currentJob.status.progress.done / currentJob.status.progress.total) * 100}%`
                          }}
                        />
                      </div>
                    </div>

                    {/* Steps - Retro Style */}
                    <div className="space-y-2">
                      {currentJob.status.steps.map((step, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm font-mono">
                          {step.ok ? (
                            <CheckCircle size={16} className="text-green-400" />
                          ) : (
                            <Clock size={16} className="text-yellow-400" />
                          )}
                          <span className={step.ok ? 'text-green-400' : 'text-yellow-400'}>
                            {step.name.toUpperCase()}
                          </span>
                          {step.done !== undefined && step.total !== undefined && (
                            <span className="text-cyan-300">
                              ({step.done}/{step.total})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Download Button - Retro Style */}
                    {currentJob.finalUrl && (
                      <div className="pt-4 border-t border-cyan-600">
                        <a
                          href={currentJob.finalUrl}
                          download
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transform hover:scale-105 transition-all duration-300 border-2 border-green-300"
                        >
                          <Download size={20} />
                          <span>DOWNLOAD AUDIO</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tuning Panel - Retro Style */}
          <div className="xl:col-span-2">
            <div className="bg-black/80 border-2 border-purple-400 rounded-lg p-6 backdrop-blur-sm shadow-lg shadow-purple-400/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-purple-400 font-mono tracking-wider">
                  ⚙️ TUNING MATRIX
                </h3>
                <button
                  onClick={() => setShowTuning(!showTuning)}
                  className="text-purple-300 hover:text-purple-100 transition-colors p-2 rounded border border-purple-500 hover:border-purple-300"
                >
                  <Settings size={20} />
                </button>
              </div>
              
              {showTuning && (
                <div className="retro-tuning-panel space-y-4">
                  <TuningPanel
                    settings={settings}
                    onChange={setSettings}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Retro Style */}
        <footer className="mt-16 text-center">
          <div className="bg-black/50 border border-cyan-400 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-cyan-300 text-sm font-mono">
              Call 1-800-TOYOTA for more information and the location of your nearest dealer. 
              Get More From Life... Buckle Up! *EPA estimated 30 city/36 highway MPG for Tercel Deluxe 
              Coupe with five-speed manual transmission. © 1990 Toyota Motor Sales, U.S.A., Inc.
            </p>
          </div>
        </footer>
      </div>

      {/* Custom CSS for retro styling */}
      <style jsx global>{`
        .retro-tuning-panel {
          font-family: 'Courier New', monospace;
        }
        
        .retro-tuning-panel input,
        .retro-tuning-panel select,
        .retro-tuning-panel textarea {
          background: rgba(0, 0, 0, 0.8) !important;
          border: 2px solid #a855f7 !important;
          color: #e879f9 !important;
          font-family: 'Courier New', monospace !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
          font-weight: bold !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
        }
        
        .retro-tuning-panel input:focus,
        .retro-tuning-panel select:focus,
        .retro-tuning-panel textarea:focus {
          border-color: #06b6d4 !important;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.5) !important;
          outline: none !important;
        }
        
        .retro-tuning-panel label {
          color: #a855f7 !important;
          font-family: 'Courier New', monospace !important;
          font-weight: bold !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          font-size: 12px !important;
        }
        
        .retro-tuning-panel button {
          background: linear-gradient(to right, #7c3aed, #a855f7) !important;
          border: 2px solid #c084fc !important;
          color: white !important;
          font-family: 'Courier New', monospace !important;
          font-weight: bold !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          border-radius: 6px !important;
          padding: 8px 16px !important;
          transition: all 0.3s ease !important;
        }
        
        .retro-tuning-panel button:hover {
          background: linear-gradient(to right, #8b5cf6, #c084fc) !important;
          border-color: #e879f9 !important;
          box-shadow: 0 0 15px rgba(232, 121, 249, 0.5) !important;
          transform: scale(1.05) !important;
        }
        
        .retro-tuning-panel .bg-white {
          background: rgba(0, 0, 0, 0.9) !important;
          border: 2px solid #a855f7 !important;
          border-radius: 8px !important;
        }
        
        .retro-tuning-panel .text-gray-900 {
          color: #e879f9 !important;
        }
        
        .retro-tuning-panel .text-gray-600 {
          color: #c084fc !important;
        }
        
        .retro-tuning-panel .border-gray-300 {
          border-color: #a855f7 !important;
        }
      `}</style>
    </div>
  );
}
