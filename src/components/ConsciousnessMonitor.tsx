/**
 * Consciousness Monitor - Real-time visualization of neuromorphic processing
 * 
 * Provides live monitoring of consciousness state, packet flows, and performance metrics
 * for the Moshi neuromorphic layer.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { ConsciousnessState, ProcessingMetrics } from '../lib/moshi-neuromorphic/ConsciousnessOrchestrator';
import type { PerformanceProfile } from '../lib/moshi-neuromorphic/PerformanceOptimizer';

interface ConsciousnessMonitorProps {
  moshiBridge?: any; // MoshiModelBridge instance
  updateInterval?: number; // ms
  className?: string;
}

interface VisualizationData {
  consciousness: ConsciousnessState;
  metrics: ProcessingMetrics;
  performance: PerformanceProfile | null;
  history: {
    arousal: number[];
    confidence: number[];
    packetRates: number[];
    latencies: number[];
    timestamps: number[];
  };
}

export const ConsciousnessMonitor: React.FC<ConsciousnessMonitorProps> = ({
  moshiBridge,
  updateInterval = 100,
  className = ''
}) => {
  const [data, setData] = useState<VisualizationData>({
    consciousness: {
      arousal: 0.5,
      focus: null,
      workingMemory: new Map(),
      emotionalTone: 0,
      confidence: 0.5
    },
    metrics: {
      packetsProcessed: 0,
      thoughtsRaced: 0,
      attentionShifts: 0,
      gammaBindingEvents: 0,
      hebbianUpdates: 0,
      averageLatency: 0
    },
    performance: null,
    history: {
      arousal: [],
      confidence: [],
      packetRates: [],
      latencies: [],
      timestamps: []
    }
  });

  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start/stop monitoring
  useEffect(() => {
    if (isRunning && moshiBridge) {
      intervalRef.current = setInterval(updateData, updateInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, moshiBridge, updateInterval]);

  // Update visualization data
  const updateData = () => {
    if (!moshiBridge) return;

    try {
      const consciousness = moshiBridge.getConsciousnessState();
      const metrics = moshiBridge.getProcessingMetrics();
      const performance = moshiBridge.getPerformanceProfile();

      setData(prevData => {
        const newHistory = { ...prevData.history };
        const timestamp = Date.now();

        // Add new data points
        newHistory.arousal.push(consciousness.arousal);
        newHistory.confidence.push(consciousness.confidence);
        newHistory.packetRates.push(performance?.packetsPerSecond || 0);
        newHistory.latencies.push(performance?.avgConsciousnessCycleTime || 0);
        newHistory.timestamps.push(timestamp);

        // Keep last 100 points
        const maxPoints = 100;
        Object.keys(newHistory).forEach(key => {
          if (newHistory[key as keyof typeof newHistory].length > maxPoints) {
            newHistory[key as keyof typeof newHistory].shift();
          }
        });

        return {
          consciousness,
          metrics,
          performance,
          history: newHistory
        };
      });
    } catch (error) {
      console.error('Error updating consciousness data:', error);
    }
  };

  // Draw real-time graphs
  useEffect(() => {
    drawGraphs();
  }, [data]);

  const drawGraphs = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Graph dimensions
    const graphHeight = height / 4;
    const graphWidth = width - 80;
    const graphX = 60;

    // Draw arousal graph
    drawGraph(ctx, data.history.arousal, graphX, 10, graphWidth, graphHeight, '#ff6b6b', 'Arousal', 0, 1);
    
    // Draw confidence graph
    drawGraph(ctx, data.history.confidence, graphX, graphHeight + 20, graphWidth, graphHeight, '#4ecdc4', 'Confidence', 0, 1);
    
    // Draw packet rate graph
    const maxPacketRate = Math.max(...data.history.packetRates, 100);
    drawGraph(ctx, data.history.packetRates, graphX, graphHeight * 2 + 30, graphWidth, graphHeight, '#45b7d1', 'Packets/sec', 0, maxPacketRate);
    
    // Draw latency graph
    const maxLatency = Math.max(...data.history.latencies, 50);
    drawGraph(ctx, data.history.latencies, graphX, graphHeight * 3 + 40, graphWidth, graphHeight, '#f9ca24', 'Latency (ms)', 0, maxLatency);
  };

  const drawGraph = (
    ctx: CanvasRenderingContext2D,
    values: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    label: string,
    min: number,
    max: number
  ) => {
    if (values.length < 2) return;

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(x, y, width, height);

    // Draw border
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Draw label
    ctx.fillStyle = '#333';
    ctx.font = '12px monospace';
    ctx.fillText(label, x - 50, y + height / 2);

    // Draw min/max labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText(max.toFixed(1), x - 40, y + 12);
    ctx.fillText(min.toFixed(1), x - 40, y + height - 2);

    // Draw graph line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const stepX = width / (values.length - 1);
    values.forEach((value, index) => {
      const plotX = x + index * stepX;
      const normalizedValue = (value - min) / (max - min);
      const plotY = y + height - (normalizedValue * height);

      if (index === 0) {
        ctx.moveTo(plotX, plotY);
      } else {
        ctx.lineTo(plotX, plotY);
      }
    });

    ctx.stroke();

    // Draw current value
    const currentValue = values[values.length - 1];
    ctx.fillStyle = color;
    ctx.font = '11px monospace';
    ctx.fillText(currentValue.toFixed(2), x + width + 5, y + height / 2);
  };

  const formatWorkingMemory = (memory: Map<string, any>) => {
    return Array.from(memory.entries()).map(([key, value]) => (
      <div key={key} className="text-xs">
        <span className="font-mono text-blue-600">{key}</span>: {Array.isArray(value) ? `${value.length} items` : 'object'}
      </div>
    ));
  };

  const getBottleneckColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  return (
    <div className={`p-4 bg-white rounded-lg shadow-lg ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Consciousness Monitor</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-4 py-2 rounded text-white font-medium ${
              isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isRunning ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={() => setData(prev => ({ ...prev, history: { arousal: [], confidence: [], packetRates: [], latencies: [], timestamps: [] } }))}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Real-time graphs */}
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold mb-2">Real-time Metrics</h3>
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="border border-gray-300 rounded bg-gray-50"
          />
        </div>

        {/* Consciousness state */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Consciousness State</h3>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded">
              <div className="flex justify-between">
                <span className="font-medium">Arousal:</span>
                <span className="font-mono">{data.consciousness.arousal.toFixed(3)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${data.consciousness.arousal * 100}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded">
              <div className="flex justify-between">
                <span className="font-medium">Confidence:</span>
                <span className="font-mono">{data.consciousness.confidence.toFixed(3)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${data.consciousness.confidence * 100}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded">
              <div className="font-medium mb-1">Focus:</div>
              <div className="font-mono text-sm text-gray-600">
                {data.consciousness.focus || 'No focus'}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded">
              <div className="font-medium mb-1">Emotional Tone:</div>
              <div className={`font-mono text-sm ${
                data.consciousness.emotionalTone > 0 ? 'text-green-600' : 
                data.consciousness.emotionalTone < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {data.consciousness.emotionalTone.toFixed(3)}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded">
              <div className="font-medium mb-1">Working Memory:</div>
              <div className="max-h-24 overflow-y-auto">
                {data.consciousness.workingMemory.size > 0 ? 
                  formatWorkingMemory(data.consciousness.workingMemory) :
                  <div className="text-gray-500 text-sm">Empty</div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Processing metrics */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded">
          <div className="text-2xl font-bold text-blue-600">{data.metrics.packetsProcessed}</div>
          <div className="text-sm text-gray-600">Packets Processed</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded">
          <div className="text-2xl font-bold text-green-600">{data.metrics.thoughtsRaced}</div>
          <div className="text-sm text-gray-600">Thoughts Raced</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded">
          <div className="text-2xl font-bold text-purple-600">{data.metrics.attentionShifts}</div>
          <div className="text-sm text-gray-600">Attention Shifts</div>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded">
          <div className="text-2xl font-bold text-orange-600">{data.metrics.gammaBindingEvents}</div>
          <div className="text-sm text-gray-600">Gamma Binding</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded">
          <div className="text-2xl font-bold text-red-600">{data.metrics.hebbianUpdates}</div>
          <div className="text-sm text-gray-600">Hebbian Updates</div>
        </div>
      </div>

      {/* Performance bottlenecks */}
      {data.performance?.bottlenecks && data.performance.bottlenecks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Performance Bottlenecks</h3>
          <div className="space-y-2">
            {data.performance.bottlenecks.slice(0, 5).map((bottleneck, index) => (
              <div key={index} className={`p-3 rounded-lg ${getBottleneckColor(bottleneck.impact)}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{bottleneck.component}</div>
                    <div className="text-sm">{bottleneck.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{bottleneck.avgLatency.toFixed(1)}ms</div>
                    <div className="text-xs capitalize">{bottleneck.impact}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsciousnessMonitor;