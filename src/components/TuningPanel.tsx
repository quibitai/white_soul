/**
 * Comprehensive tuning panel for dev_plan_02 architecture
 * Provides all controls for voice, cadence, chunking, stitching, mastering, and export
 */

'use client';

import { useState } from 'react';
import { 
  Sliders, 
  Volume2, 
  Scissors, 
  Link, 
  BarChart3, 
  Download,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TuningSettings } from '@/lib/types/tuning';

interface TuningPanelProps {
  settings: TuningSettings;
  onChange: (settings: TuningSettings) => void;
  onReset: () => void;
  onSavePreset: (name: string) => void;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
}

export default function TuningPanel({ 
  settings, 
  onChange, 
  onReset, 
  onSavePreset 
}: TuningPanelProps) {
  const [sections, setSections] = useState<Section[]>([
    { id: 'voice', title: 'Voice Settings', icon: <Volume2 size={18} />, expanded: false },
    { id: 'cadence', title: 'Cadence & SSML', icon: <Sliders size={18} />, expanded: false },
    { id: 'chunking', title: 'Chunking', icon: <Scissors size={18} />, expanded: false },
    { id: 'stitching', title: 'Stitching', icon: <Link size={18} />, expanded: false },
    { id: 'mastering', title: 'Mastering', icon: <BarChart3 size={18} />, expanded: false },
    { id: 'export', title: 'Export', icon: <Download size={18} />, expanded: false },
  ]);

  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, expanded: !section.expanded }
        : section
    ));
  };

  const updateSettings = (path: string[], value: unknown) => {
    const newSettings = { ...settings };
    let current: Record<string, unknown> = newSettings as Record<string, unknown>;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]] as Record<string, unknown>;
    }
    
    current[path[path.length - 1]] = value;
    onChange(newSettings);
  };

  const SliderControl = ({ 
    label, 
    value, 
    min, 
    max, 
    step, 
    path, 
    unit = '',
    description 
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    path: string[];
    unit?: string;
    description?: string;
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <label className="text-sm font-medium text-gray-900 flex-1 leading-tight">{label}</label>
        <span className="text-sm text-gray-900 font-semibold whitespace-nowrap">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => updateSettings(path, parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
      />
      {description && (
        <p className="text-xs text-gray-800 font-medium">{description}</p>
      )}
    </div>
  );

  const CheckboxControl = ({ 
    label, 
    checked, 
    path, 
    description 
  }: {
    label: string;
    checked: boolean;
    path: string[];
    description?: string;
  }) => (
    <div className="space-y-1">
      <label className="flex items-center space-x-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => updateSettings(path, e.target.checked)}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </label>
      {description && (
        <p className="text-xs text-gray-800 font-medium ml-6">{description}</p>
      )}
    </div>
  );

  const SelectControl = ({ 
    label, 
    value, 
    options, 
    path, 
    description 
  }: {
    label: string;
    value: string | number;
    options: Array<{ value: string | number; label: string }>;
    path: string[];
    description?: string;
  }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-900">{label}</label>
      <select
        value={value}
        onChange={(e) => updateSettings(path, 
          typeof value === 'number' ? parseFloat(e.target.value) : e.target.value
        )}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description && (
        <p className="text-xs text-gray-800 font-medium">{description}</p>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-3">Voice Tuning Controls</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={onReset}
            className="flex items-center space-x-1 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-md transition-colors h-9"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button
            onClick={() => setShowPresetSave(!showPresetSave)}
            className="flex items-center space-x-1 px-4 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md transition-colors h-9"
          >
            <Save size={14} />
            <span>Save Preset</span>
          </button>
        </div>
      </div>

      {showPresetSave && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="flex-1 px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => {
                if (presetName.trim()) {
                  onSavePreset(presetName.trim());
                  setPresetName('');
                  setShowPresetSave(false);
                }
              }}
              disabled={!presetName.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {sections.map(section => (
          <div key={section.id} className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                {section.icon}
                <span className="font-semibold text-gray-900">{section.title}</span>
              </div>
              {section.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            
            {section.expanded && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                {section.id === 'voice' && (
                  <div className="space-y-4">
                    <SliderControl
                      label="Stability"
                      value={settings.eleven.stability}
                      min={0}
                      max={1}
                      step={0.01}
                      path={['eleven', 'stability']}
                      description="Voice consistency (0.58 recommended for Angela)"
                    />
                    <SliderControl
                      label="Similarity Boost"
                      value={settings.eleven.similarityBoost}
                      min={0}
                      max={1}
                      step={0.01}
                      path={['eleven', 'similarityBoost']}
                      description="Voice similarity to original (0.85 recommended)"
                    />
                    <SliderControl
                      label="Style"
                      value={settings.eleven.style}
                      min={0}
                      max={1}
                      step={0.01}
                      path={['eleven', 'style']}
                      description="Style exaggeration (0.22 for natural delivery)"
                    />
                    <CheckboxControl
                      label="Speaker Boost"
                      checked={settings.eleven.speakerBoost}
                      path={['eleven', 'speakerBoost']}
                      description="Enhance speaker characteristics"
                    />
                  </div>
                )}

                {section.id === 'cadence' && (
                  <div className="space-y-4">
                    <div className="space-y-6">
                      <SliderControl
                        label="Comma Pause"
                        value={settings.ssml.breakMs.comma}
                        min={50}
                        max={500}
                        step={10}
                        path={['ssml', 'breakMs', 'comma']}
                        unit="ms"
                      />
                      <SliderControl
                        label="Clause Pause"
                        value={settings.ssml.breakMs.clause}
                        min={100}
                        max={800}
                        step={10}
                        path={['ssml', 'breakMs', 'clause']}
                        unit="ms"
                      />
                      <SliderControl
                        label="Sentence Pause"
                        value={settings.ssml.breakMs.sentence}
                        min={200}
                        max={1000}
                        step={10}
                        path={['ssml', 'breakMs', 'sentence']}
                        unit="ms"
                      />
                      <SliderControl
                        label="Paragraph Pause"
                        value={settings.ssml.breakMs.paragraph}
                        min={400}
                        max={2000}
                        step={50}
                        path={['ssml', 'breakMs', 'paragraph']}
                        unit="ms"
                      />
                    </div>
                    
                    <div className="space-y-6">
                      <SliderControl
                        label="Tag Density (per 10 words)"
                        value={settings.ssml.tagDensityMaxPer10Words}
                        min={0.5}
                        max={3}
                        step={0.1}
                        path={['ssml', 'tagDensityMaxPer10Words']}
                        description="Maximum SSML tags per 10 words"
                      />
                      <SliderControl
                        label="Default Rate"
                        value={settings.ssml.defaultRate}
                        min={0.7}
                        max={1.3}
                        step={0.01}
                        path={['ssml', 'defaultRate']}
                        description="Speech rate multiplier"
                      />
                      <SliderControl
                        label="Default Pitch"
                        value={settings.ssml.defaultPitchSt}
                        min={-6}
                        max={6}
                        step={0.1}
                        path={['ssml', 'defaultPitchSt']}
                        unit="st"
                        description="Pitch adjustment in semitones"
                      />
                    </div>
                    
                    <CheckboxControl
                      label="Enable Intimate Block"
                      checked={settings.ssml.enableIntimateBlock}
                      path={['ssml', 'enableIntimateBlock']}
                      description="Add intimate prosody blocks for emotional delivery"
                    />
                  </div>
                )}

                {section.id === 'chunking' && (
                  <div className="space-y-4">
                    <SliderControl
                      label="Max Chunk Duration"
                      value={settings.chunking.maxSec}
                      min={15}
                      max={60}
                      step={1}
                      path={['chunking', 'maxSec']}
                      unit="s"
                      description="Maximum duration per chunk"
                    />
                    <SliderControl
                      label="Overlap"
                      value={settings.chunking.overlapMs}
                      min={0}
                      max={1000}
                      step={50}
                      path={['chunking', 'overlapMs']}
                      unit="ms"
                      description="Overlap between chunks for smooth transitions"
                    />
                    <SliderControl
                      label="Context Sentences"
                      value={settings.chunking.contextSentences}
                      min={0}
                      max={5}
                      step={1}
                      path={['chunking', 'contextSentences']}
                      description="Sentences to include for context"
                    />
                  </div>
                )}

                {section.id === 'stitching' && (
                  <div className="space-y-4">
                    <SliderControl
                      label="Crossfade Duration"
                      value={settings.stitching.crossfadeMs}
                      min={0}
                      max={500}
                      step={10}
                      path={['stitching', 'crossfadeMs']}
                      unit="ms"
                      description="Crossfade between chunks"
                    />
                    <SelectControl
                      label="Sample Rate"
                      value={settings.stitching.sampleRate}
                      options={[
                        { value: 22050, label: '22.05 kHz (Compact)' },
                        { value: 44100, label: '44.1 kHz (CD Quality)' },
                      ]}
                      path={['stitching', 'sampleRate']}
                    />
                    <CheckboxControl
                      label="Mono Output"
                      checked={settings.stitching.mono}
                      path={['stitching', 'mono']}
                      description="Convert to mono for smaller file size"
                    />
                  </div>
                )}

                {section.id === 'mastering' && (
                  <div className="space-y-4">
                    <CheckboxControl
                      label="Enable Mastering"
                      checked={settings.mastering.enable}
                      path={['mastering', 'enable']}
                      description="Apply audio mastering pipeline"
                    />
                    
                    {settings.mastering.enable && (
                      <>
                        <div className="space-y-6">
                          <SliderControl
                            label="High-pass Filter"
                            value={settings.mastering.highpassHz}
                            min={20}
                            max={200}
                            step={5}
                            path={['mastering', 'highpassHz']}
                            unit="Hz"
                            description="Remove low-frequency rumble"
                          />
                          <SliderControl
                            label="De-esser Frequency"
                            value={settings.mastering.deesserHz}
                            min={3000}
                            max={10000}
                            step={100}
                            path={['mastering', 'deesserHz']}
                            unit="Hz"
                            description="Target frequency for sibilance reduction"
                          />
                          <SliderControl
                            label="De-esser Amount"
                            value={settings.mastering.deesserAmount}
                            min={0}
                            max={1}
                            step={0.05}
                            path={['mastering', 'deesserAmount']}
                            description="Sibilance reduction intensity"
                          />
                        </div>
                        
                        <div className="p-4 bg-white rounded-lg border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-3">Compressor</h4>
                          <div className="space-y-6">
                            <SliderControl
                              label="Ratio"
                              value={settings.mastering.compressor.ratio}
                              min={1}
                              max={10}
                              step={0.1}
                              path={['mastering', 'compressor', 'ratio']}
                              unit=":1"
                            />
                            <SliderControl
                              label="Attack"
                              value={settings.mastering.compressor.attackMs}
                              min={1}
                              max={100}
                              step={1}
                              path={['mastering', 'compressor', 'attackMs']}
                              unit="ms"
                            />
                            <SliderControl
                              label="Release"
                              value={settings.mastering.compressor.releaseMs}
                              min={10}
                              max={1000}
                              step={10}
                              path={['mastering', 'compressor', 'releaseMs']}
                              unit="ms"
                            />
                            <SliderControl
                              label="Makeup Gain"
                              value={settings.mastering.compressor.gainDb}
                              min={-10}
                              max={10}
                              step={0.1}
                              path={['mastering', 'compressor', 'gainDb']}
                              unit="dB"
                            />
                          </div>
                        </div>
                        
                        <div className="p-4 bg-white rounded-lg border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-3">Loudness Normalization</h4>
                          <div className="space-y-4">
                            <SliderControl
                              label="Target LUFS"
                              value={settings.mastering.loudness.targetLUFS}
                              min={-30}
                              max={-6}
                              step={0.1}
                              path={['mastering', 'loudness', 'targetLUFS']}
                              unit=" LUFS"
                              description="Integrated loudness target (-14 for streaming)"
                            />
                            <SliderControl
                              label="True Peak Limit"
                              value={settings.mastering.loudness.truePeakDb}
                              min={-3}
                              max={0}
                              step={0.1}
                              path={['mastering', 'loudness', 'truePeakDb']}
                              unit=" dBTP"
                              description="Maximum true peak level"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {section.id === 'export' && (
                  <div className="space-y-4">
                    <SelectControl
                      label="Format"
                      value={settings.export.format}
                      options={[
                        { value: 'mp3', label: 'MP3 (Compressed)' },
                        { value: 'wav', label: 'WAV (Uncompressed)' },
                        { value: 'aac', label: 'AAC (Compressed)' },
                      ]}
                      path={['export', 'format']}
                    />
                    {(settings.export.format === 'mp3' || settings.export.format === 'aac') && (
                      <SliderControl
                        label="Bitrate"
                        value={settings.export.bitrateKbps || 224}
                        min={64}
                        max={320}
                        step={32}
                        path={['export', 'bitrateKbps']}
                        unit=" kbps"
                        description="Audio quality (higher = better quality, larger file)"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
