import React, { useState, useEffect } from 'react';
import type { RealtimeControlsProps, WhisperXConfig } from '../../../types/whisperx';
import { prefetchSelectedModels } from '../utils/modelPrefetch';
import { getHFToken, setHFToken } from '../utils/hfAuth';
import { applyHFTokenFromStorage } from '../utils/hfAuth';

export const RealtimeControls: React.FC<RealtimeControlsProps> = ({
  whisperX,
  showAdvanced = false,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showConfig, setShowConfig] = useState(showAdvanced);
  const [localConfig, setLocalConfig] = useState<Partial<WhisperXConfig>>({});
  const [isPulling, setIsPulling] = useState(false);
  const [pullLog, setPullLog] = useState<string[]>([]);
  const [pullOk, setPullOk] = useState<boolean | null>(null);
  const [hfToken, setHfToken] = useState<string>(getHFToken() || '');
  const [tokenSaved, setTokenSaved] = useState<boolean>(!!getHFToken());

  const { state, config, error } = whisperX;

  useEffect(() => {
    setIsRecording(state.isListening);
  }, [state.isListening]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    // Apply any token from storage/window/Vite env at mount
    applyHFTokenFromStorage();
    const t = getHFToken();
    if (t) {
      setHfToken(t);
      setTokenSaved(true);
    }
  }, []);

  const deviceLabel = (typeof navigator !== 'undefined' && 'gpu' in navigator) ? 'webgpu' : 'wasm';

  const appendLog = (msg: string) => setPullLog((l) => [...l, msg]);

  const handlePull = async () => {
    try {
      setIsPulling(true);
      setPullOk(null);
      setPullLog([]);
      const whisperModel = (localConfig.whisperModel || config.whisperModel) as WhisperXConfig['whisperModel'];
      const alignmentModel = (localConfig.alignmentModel || config.alignmentModel) as WhisperXConfig['alignmentModel'];
      await prefetchSelectedModels(whisperModel, alignmentModel, appendLog);
      setPullOk(true);
      appendLog('Done. Models cached in browser.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setPullOk(false);
      appendLog(`Failed: ${msg}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleStartStop = async () => {
    try {
      if (isRecording) {
        whisperX.stopRealtime();
      } else {
        await whisperX.startRealtime();
      }
    } catch {
      // no-op in production
    }
  };

  const handlePause = () => {
    whisperX.pause();
  };

  const handleResume = async () => {
    try {
      await whisperX.resume();
    } catch {
      // no-op in production
    }
  };

  const handleReset = () => {
    whisperX.reset();
  };

  const handleConfigChange = <K extends keyof WhisperXConfig>(key: K, value: WhisperXConfig[K]) => {
    const newConfig = { ...localConfig, [key]: value } as WhisperXConfig;
    setLocalConfig(newConfig);
    whisperX.updateConfig(newConfig);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const handleSaveToken = () => {
    const trimmed = hfToken.trim();
    if (!trimmed) return;
    const persisted = setHFToken(trimmed);
    // Apply to Transformers env immediately
    applyHFTokenFromStorage();
    setTokenSaved(true);
    appendLog(persisted
      ? 'HF token saved to browser storage and applied.'
      : 'HF token applied for this session (could not persist to storage).');
  };

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      {/* Main Controls */}
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-1">
          {/* ...existing left ... */}
          <div className="flex items-center gap-2">
            {/* HF token controls */}
            <div className="hidden md:flex items-center gap-2 mr-2">
              <input
                type="password"
                placeholder="HF token"
                value={hfToken}
                onChange={(e) => setHfToken(e.target.value)}
                className="text-sm px-2 py-1 border rounded w-44"
              />
              <button
                onClick={handleSaveToken}
                disabled={!hfToken.trim()}
                className="text-sm px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                title="Save Hugging Face token"
              >
                Save token
              </button>
            </div>
            <button
              onClick={handlePull}
              disabled={isPulling}
              className={`text-sm px-3 py-1 rounded border ${isPulling ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              title="Download selected models to browser cache"
            >
              {isPulling ? 'Pulling…' : 'Pull models'}
            </button>
            {showAdvanced && (
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 rounded border hover:bg-gray-50"
              >
                {showConfig ? 'Hide Config' : 'Show Config'}
              </button>
            )}
          </div>
        </div>
        {/* Info row */}
        <div className="mb-4 text-xs text-gray-500">
          Target model: <span className="font-medium text-gray-700">{config.whisperModel}</span>
          <span className="mx-2">•</span>
          Device: <span className="font-medium text-gray-700">{deviceLabel}</span>
          {tokenSaved && <>
            <span className="mx-2">•</span>
            <span className="text-green-700">HF token saved</span>
          </>}
        </div>

        {/* Primary Controls */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleStartStop}
            disabled={!state.isInitialized}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
              ${isRecording 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
              }
              ${!state.isInitialized ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-green-200'}`} />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>

          {isRecording && (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <div className="w-2 h-3 bg-white rounded-sm" />
              <div className="w-2 h-3 bg-white rounded-sm" />
              Pause
            </button>
          )}

          {!isRecording && state.isListening && (
            <button
              onClick={handleResume}
              className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white"
            >
              <div className="w-0 h-0 border-l-4 border-l-white border-y-2 border-y-transparent" />
              Resume
            </button>
          )}

          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">
              {Math.round(state.audioLevel * 100)}
            </div>
            <div className="text-sm text-gray-600">Audio Level</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-100"
                style={{ width: `${Math.min(state.audioLevel * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {state.performance.realTimeFactor.toFixed(2)}x
            </div>
            <div className="text-sm text-gray-600">Real-time Factor</div>
            <div className={`text-xs mt-1 ${state.performance.realTimeFactor < 1 ? 'text-green-600' : 'text-red-600'}`}>
              {state.performance.realTimeFactor < 1 ? 'Faster than real-time' : 'Slower than real-time'}
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatDuration(state.performance.processingTime)}
            </div>
            <div className="text-sm text-gray-600">Processing Time</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(state.performance.memoryUsage)}MB
            </div>
            <div className="text-sm text-gray-600">Memory Usage</div>
          </div>
        </div>

        {/* Current Speaker */}
        {state.currentSpeaker && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="font-medium text-blue-800">Current Speaker:</span>
              <span className="text-blue-600">{state.currentSpeaker}</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 text-red-500 mt-0.5">⚠️</div>
              <div>
                <div className="font-medium text-red-800">Error</div>
                <div className="text-red-600 text-sm mt-1">{error.message}</div>
              </div>
            </div>
          </div>
        )}

        {/* Pull log */}
        {pullLog.length > 0 && (
          <div className={`mt-3 p-3 rounded border ${pullOk === false ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-auto">
              {pullLog.join('\n')}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Configuration */}
      {showAdvanced && showConfig && (
        <div className="border-t p-4 bg-gray-50">
          <h4 className="text-md font-semibold text-gray-800 mb-4">Configuration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model Settings */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Models</h5>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">Whisper Model</label>
                <select
                  value={localConfig.whisperModel || 'base.en'}
                  onChange={(e) => handleConfigChange('whisperModel', e.target.value as WhisperXConfig['whisperModel'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="tiny">tiny</option>
                  <option value="tiny.en">tiny.en</option>
                  <option value="base">base</option>
                  <option value="base.en">base.en</option>
                  <option value="small">small</option>
                  <option value="small.en">small.en</option>
                  <option value="medium">medium</option>
                  <option value="medium.en">medium.en</option>
                  <option value="large-v1">large-v1</option>
                  <option value="large-v2">large-v2</option>
                  <option value="large-v3">large-v3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Alignment Model</label>
                <select
                  value={localConfig.alignmentModel || 'wav2vec2-base'}
                  onChange={(e) => handleConfigChange('alignmentModel', e.target.value as WhisperXConfig['alignmentModel'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="wav2vec2-base">wav2vec2-base</option>
                  <option value="wav2vec2-large">wav2vec2-large</option>
                </select>
              </div>
            </div>

            {/* Performance Settings */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Performance</h5>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Batch Size: {localConfig.batchSize || 16}
                </label>
                <input
                  type="range"
                  min="1"
                  max="32"
                  value={localConfig.batchSize || 16}
                  onChange={(e) => handleConfigChange('batchSize', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Chunk Length: {localConfig.chunkLength || 30}s
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={localConfig.chunkLength || 30}
                  onChange={(e) => handleConfigChange('chunkLength', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  VAD Threshold: {(localConfig.vadThreshold || 0.5).toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={localConfig.vadThreshold || 0.5}
                  onChange={(e) => handleConfigChange('vadThreshold', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Features</h5>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localConfig.enableVAD ?? true}
                  onChange={(e) => handleConfigChange('enableVAD', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Voice Activity Detection</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localConfig.enableAlignment ?? true}
                  onChange={(e) => handleConfigChange('enableAlignment', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Forced Alignment</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={localConfig.enableDiarization ?? true}
                  onChange={(e) => handleConfigChange('enableDiarization', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Speaker Diarization</span>
              </label>
            </div>

            {/* Audio Settings */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Audio</h5>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">Sample Rate</label>
                <select
                  value={localConfig.sampleRate || 16000}
                  onChange={(e) => handleConfigChange('sampleRate', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={8000}>8 kHz</option>
                  <option value={16000}>16 kHz</option>
                  <option value={22050}>22.05 kHz</option>
                  <option value={44100}>44.1 kHz</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Channels</label>
                <select
                  value={localConfig.channels || 1}
                  onChange={(e) => handleConfigChange('channels', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>Mono</option>
                  <option value={2}>Stereo</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact version for smaller spaces
export const CompactRealtimeControls: React.FC<Omit<RealtimeControlsProps, 'showAdvanced'>> = ({
  whisperX,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const { state, error } = whisperX;

  useEffect(() => {
    setIsRecording(state.isListening);
  }, [state.isListening]);

  const handleStartStop = async () => {
    try {
      if (isRecording) {
        whisperX.stopRealtime();
      } else {
        await whisperX.startRealtime();
      }
    } catch (err) {
      console.error('Failed to toggle recording:', err);
    }
  };

  return (
    <div className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${className}`}>
      <button
        onClick={handleStartStop}
        disabled={!state.isInitialized}
        className={`
          flex items-center gap-2 px-4 py-2 rounded font-medium transition-all text-sm
          ${isRecording 
            ? 'bg-red-600 hover:bg-red-700 text-white' 
            : 'bg-green-600 hover:bg-green-700 text-white'
          }
          ${!state.isInitialized ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white' : 'bg-green-200'}`} />
        {isRecording ? 'Stop' : 'Start'}
      </button>

      <div className="text-sm text-gray-600">
        Level: {Math.round(state.audioLevel * 100)}%
      </div>

      <div className="text-sm text-gray-600">
        RTF: {state.performance.realTimeFactor.toFixed(2)}x
      </div>

      {error && (
        <div className="text-sm text-red-600 truncate max-w-32" title={error.message}>
          Error: {error.message}
        </div>
      )}
    </div>
  );
};

export default RealtimeControls;
