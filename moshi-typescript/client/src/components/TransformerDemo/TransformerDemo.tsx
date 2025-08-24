import React, { useState, useCallback, useEffect } from 'react';
import { createTransformer, TensorUtils, type TransformerConfig } from '../../transformers';
import type { WebTransformer } from '../../transformers';

interface TransformerDemoProps {
  className?: string;
}

export const TransformerDemo: React.FC<TransformerDemoProps> = ({ className }) => {
  const [transformer, setTransformer] = useState<WebTransformer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<TransformerConfig>({
    modelSize: 'small',
    task: 'text-generation',
    device: 'cpu',
    precision: 'float32',
  });
  const [output, setOutput] = useState<string>('');

  const initializeTransformer = useCallback(async () => {
    setIsLoading(true);
    setOutput('');
    
    try {
      const newTransformer = await createTransformer(config);
      setTransformer(newTransformer);
      setOutput('✅ Transformer initialized successfully!');
    } catch (error) {
      setOutput(`❌ Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const runInference = useCallback(async () => {
    if (!transformer) {
      setOutput('❌ Transformer not initialized');
      return;
    }

    try {
      // Create a simple test input
      const input = TensorUtils.arange(0, 24, 1);
      const reshaped = TensorUtils.reshape(input, [1, 6, 4]); // batch=1, seq=6, dim=4
      
      setOutput('🔄 Running inference...');
      
      const result = transformer.forward(reshaped);
      
      setOutput(`✅ Inference complete!
Input shape: [${reshaped.shape.join(', ')}]
Output shape: [${result.shape.join(', ')}]
Sample output: [${Array.from(result.data.slice(0, 8)).map(n => n.toFixed(3)).join(', ')}...]`);
      
    } catch (error) {
      setOutput(`❌ Inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [transformer]);

  const testStreamingState = useCallback(async () => {
    if (!transformer) {
      setOutput('❌ Transformer not initialized');
      return;
    }

    try {
      const streamingState = transformer.createStreamingState(3);
      
      // Test streaming state operations
      streamingState.offsets.data[0] = 10;
      streamingState.offsets.data[1] = 20;
      streamingState.offsets.data[2] = 30;
      
      const beforeReset = Array.from(streamingState.offsets.data);
      
      streamingState.reset([true, false, true]);
      const afterReset = Array.from(streamingState.offsets.data);
      
      setOutput(`✅ Streaming state test complete!
Before reset: [${beforeReset.join(', ')}]
After selective reset: [${afterReset.join(', ')}]`);
      
    } catch (error) {
      setOutput(`❌ Streaming state test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [transformer]);

  // Initialize on mount
  useEffect(() => {
    initializeTransformer();
  }, []);

  return (
    <div className={`p-6 bg-gray-900 text-white rounded-lg ${className || ''}`}>
      <h2 className="text-2xl font-bold mb-4">Web Transformer Demo</h2>
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Model Size:</label>
            <select
              value={config.modelSize}
              onChange={(e) => setConfig(prev => ({ ...prev, modelSize: e.target.value as any }))}
              className="w-full p-2 bg-gray-800 rounded border border-gray-600"
              disabled={isLoading}
            >
              <option value="small">Small</option>
              <option value="base">Base</option>
              <option value="large">Large</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Task:</label>
            <select
              value={config.task}
              onChange={(e) => setConfig(prev => ({ ...prev, task: e.target.value as any }))}
              className="w-full p-2 bg-gray-800 rounded border border-gray-600"
              disabled={isLoading}
            >
              <option value="text-generation">Text Generation</option>
              <option value="audio-processing">Audio Processing</option>
              <option value="multimodal">Multimodal</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Device:</label>
            <select
              value={config.device}
              onChange={(e) => setConfig(prev => ({ ...prev, device: e.target.value as any }))}
              className="w-full p-2 bg-gray-800 rounded border border-gray-600"
              disabled={isLoading}
            >
              <option value="cpu">CPU</option>
              <option value="gpu">GPU (WebGPU)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Precision:</label>
            <select
              value={config.precision}
              onChange={(e) => setConfig(prev => ({ ...prev, precision: e.target.value as any }))}
              className="w-full p-2 bg-gray-800 rounded border border-gray-600"
              disabled={isLoading}
            >
              <option value="float32">Float32</option>
              <option value="float16">Float16</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4 space-x-2">
        <button
          onClick={initializeTransformer}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
        >
          {isLoading ? '🔄 Initializing...' : '🚀 Initialize'}
        </button>
        
        <button
          onClick={runInference}
          disabled={!transformer || isLoading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded"
        >
          🔮 Run Inference
        </button>
        
        <button
          onClick={testStreamingState}
          disabled={!transformer || isLoading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded"
        >
          🌊 Test Streaming
        </button>
      </div>

      <div className="bg-gray-800 p-4 rounded">
        <h3 className="text-lg font-semibold mb-2">Output</h3>
        <pre className="text-sm whitespace-pre-wrap text-green-400">
          {output || 'Click Initialize to get started...'}
        </pre>
      </div>
      
      <div className="mt-4 text-sm text-gray-400">
        <p>
          This demo showcases the new Web-based transformer implementation using standard Web APIs.
          It supports WebGPU acceleration when available and falls back to CPU processing.
        </p>
      </div>
    </div>
  );
};