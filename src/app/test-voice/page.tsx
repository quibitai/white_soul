/**
 * Simple voice testing page for Angela's raw TTS output
 * Allows testing the voice without any processing or audio tags
 */

'use client';

import { useState } from 'react';

export default function TestVoicePage() {
  const [text, setText] = useState('Hello, this is Angela speaking. The cards reveal hidden truths in your journey.');
  const [format, setFormat] = useState<'mp3_44100_128' | 'mp3_44100_192' | 'wav'>('mp3_44100_128');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const testSuggestions = [
    'Hello, this is Angela speaking.',
    'The cards reveal hidden truths in your journey.',
    'Trust your intuition, it knows the way.',
    'Welcome to your tarot reading. Let the universe guide us.',
    'Testing stability, similarity boost, and speaker enhancement settings.',
    'I sense a powerful transformation coming into your life.',
  ];

  const handleTest = async () => {
    if (!text.trim()) {
      setError('Please enter some text to test');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      const response = await fetch('/api/test-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          format,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Create blob URL for audio playback
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Log voice settings from response headers
      const voiceSettings = response.headers.get('X-Voice-Settings');
      if (voiceSettings) {
        console.log('🎤 Voice Settings Used:', JSON.parse(voiceSettings));
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Voice test error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setText(suggestion);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🎤 Angela Voice Test</h1>
            <p className="mt-2 text-gray-600">
              Test Angela's raw voice without any processing or audio tags
            </p>
          </div>

          <div className="space-y-6">
            {/* Text Input */}
            <div>
              <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
                Text to Synthesize
              </label>
              <textarea
                id="text"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to test Angela's voice..."
                maxLength={2000}
              />
              <p className="mt-1 text-sm text-gray-500">
                {text.length}/2000 characters
              </p>
            </div>

            {/* Format Selection */}
            <div>
              <label htmlFor="format" className="block text-sm font-medium text-gray-700 mb-2">
                Audio Format
              </label>
              <select
                id="format"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
              >
                <option value="mp3_44100_128">MP3 128kbps (Recommended)</option>
                <option value="mp3_44100_192">MP3 192kbps (Higher Quality)</option>
                <option value="wav">WAV (Uncompressed)</option>
              </select>
            </div>

            {/* Test Button */}
            <button
              onClick={handleTest}
              disabled={isLoading || !text.trim()}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '🔄 Synthesizing...' : '🎤 Test Angela\'s Voice'}
            </button>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">
                  <strong>Error:</strong> {error}
                </p>
              </div>
            )}

            {/* Audio Player */}
            {audioUrl && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-green-800 mb-3">✅ Voice Test Complete</h3>
                <audio controls className="w-full">
                  <source src={audioUrl} type={`audio/${format.startsWith('mp3') ? 'mpeg' : 'wav'}`} />
                  Your browser does not support audio playback.
                </audio>
                <p className="text-xs text-green-600 mt-2">
                  This audio uses raw settings from angela-voice.yaml without any processing
                </p>
              </div>
            )}
          </div>

          {/* Test Suggestions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">💡 Test Suggestions</h3>
            <div className="grid grid-cols-1 gap-2">
              {testSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>

          {/* Settings Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">⚙️ Current Voice Settings</h3>
            <div className="bg-gray-50 rounded p-3 text-sm font-mono">
              <div>stability: 0.0 (Creative mode)</div>
              <div>similarity_boost: 0.85 (High consistency)</div>
              <div>style: 0.0 (Not used in v3)</div>
              <div>speaker_boost: true (Enhanced clarity)</div>
              <div>speed: 0.85 (Contemplative pace)</div>
              <div>quality: "enhanced"</div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Settings loaded directly from angela-voice.yaml configuration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
