/**
 * Performance Optimizer for Neuromorphic Consciousness Layer
 * 
 * Analyzes and optimizes the consciousness processing cycle for real-time performance.
 * Targets sub-100ms latency for audio processing while maintaining consciousness coherence.
 */

import { NeuralPacket } from '../../experiments/neuromorphic-research/neural-packet-types';
import { ConsciousnessState, ProcessingMetrics } from './ConsciousnessOrchestrator';

export interface PerformanceProfile {
  // Timing analysis
  avgConsciousnessCycleTime: number;    // ms
  avgPacketProcessingTime: number;      // ms per packet
  avgThoughtRaceTime: number;           // ms
  avgAttentionShiftTime: number;        // ms
  avgGammaBindingTime: number;         // ms
  
  // Throughput metrics
  packetsPerSecond: number;
  consciousnessCyclesPerSecond: number;
  
  // Bottleneck identification
  bottlenecks: BottleneckReport[];
  
  // Memory usage
  memoryUsage: MemoryProfile;
  
  // Optimization recommendations
  recommendations: OptimizationRecommendation[];
}

export interface BottleneckReport {
  component: string;
  avgLatency: number;
  maxLatency: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface MemoryProfile {
  packetBufferSize: number;
  workingMemorySize: number;
  focusHistorySize: number;
  totalHeapUsed: number;
}

export interface OptimizationRecommendation {
  type: 'algorithm' | 'memory' | 'concurrency' | 'caching';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  estimatedImprovement: string;
  implementation: string;
}

export class PerformanceOptimizer {
  private measurements: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();
  private packetProcessingTimes: number[] = [];
  private consciousnessCycleTimes: number[] = [];
  
  /**
   * Start timing a performance-critical operation
   */
  public startTiming(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }
  
  /**
   * End timing and record the measurement
   */
  public endTiming(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operation}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }
    this.measurements.get(operation)!.push(duration);
    
    this.startTimes.delete(operation);
    return duration;
  }
  
  /**
   * Record packet processing metrics
   */
  public recordPacketProcessing(packets: NeuralPacket[], processingTime: number): void {
    this.packetProcessingTimes.push(processingTime / packets.length); // Per packet
  }
  
  /**
   * Record consciousness cycle metrics
   */
  public recordConsciousnessCycle(cycleTime: number): void {
    this.consciousnessCycleTimes.push(cycleTime);
  }
  
  /**
   * Generate comprehensive performance profile
   */
  public generateProfile(currentMetrics: ProcessingMetrics): PerformanceProfile {
    const profile: PerformanceProfile = {
      // Calculate averages
      avgConsciousnessCycleTime: this.calculateAverage(this.consciousnessCycleTimes),
      avgPacketProcessingTime: this.calculateAverage(this.packetProcessingTimes),
      avgThoughtRaceTime: this.getAverageForOperation('thought-race'),
      avgAttentionShiftTime: this.getAverageForOperation('attention-shift'),
      avgGammaBindingTime: this.getAverageForOperation('gamma-binding'),
      
      // Calculate throughput
      packetsPerSecond: this.calculatePacketThroughput(),
      consciousnessCyclesPerSecond: 1000 / this.calculateAverage(this.consciousnessCycleTimes),
      
      // Identify bottlenecks
      bottlenecks: this.identifyBottlenecks(),
      
      // Memory analysis
      memoryUsage: this.analyzeMemoryUsage(),
      
      // Generate recommendations
      recommendations: this.generateRecommendations()
    };
    
    return profile;
  }
  
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private getAverageForOperation(operation: string): number {
    const measurements = this.measurements.get(operation) || [];
    return this.calculateAverage(measurements);
  }
  
  private calculatePacketThroughput(): number {
    if (this.packetProcessingTimes.length === 0) return 0;
    const avgProcessingTime = this.calculateAverage(this.packetProcessingTimes);
    return 1000 / avgProcessingTime; // packets per second
  }
  
  private identifyBottlenecks(): BottleneckReport[] {
    const bottlenecks: BottleneckReport[] = [];
    
    // Analyze each operation for bottlenecks
    for (const [operation, times] of this.measurements) {
      const avgLatency = this.calculateAverage(times);
      const maxLatency = Math.max(...times);
      
      let impact: 'critical' | 'high' | 'medium' | 'low' = 'low';
      let description = '';
      
      if (avgLatency > 50) {
        impact = 'critical';
        description = `${operation} averaging ${avgLatency.toFixed(2)}ms - exceeds real-time threshold`;
      } else if (avgLatency > 25) {
        impact = 'high';
        description = `${operation} averaging ${avgLatency.toFixed(2)}ms - may impact real-time performance`;
      } else if (avgLatency > 10) {
        impact = 'medium';
        description = `${operation} averaging ${avgLatency.toFixed(2)}ms - watch for degradation`;
      } else {
        impact = 'low';
        description = `${operation} performing well at ${avgLatency.toFixed(2)}ms average`;
      }
      
      bottlenecks.push({
        component: operation,
        avgLatency,
        maxLatency,
        impact,
        description
      });
    }
    
    // Sort by impact
    return bottlenecks.sort((a, b) => {
      const impactOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }
  
  private analyzeMemoryUsage(): MemoryProfile {
    // Estimate memory usage (would need actual measurements in production)
    return {
      packetBufferSize: this.measurements.size * 100, // Estimated
      workingMemorySize: 1024 * 7, // 7 items * 1KB each (working memory limit)
      focusHistorySize: 100 * 64, // 100 focus entries * 64 bytes each
      totalHeapUsed: process.memoryUsage?.()?.heapUsed || 0
    };
  }
  
  private generateRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const avgCycleTime = this.calculateAverage(this.consciousnessCycleTimes);
    if (avgCycleTime > 50) {
      recommendations.push({
        type: 'algorithm',
        priority: 'critical',
        description: 'Consciousness cycle exceeding 50ms - implement adaptive cycle rates',
        estimatedImprovement: '40-60% latency reduction',
        implementation: 'Add dynamic cycle rate adjustment based on packet load'
      });
    }
    const raceTime = this.getAverageForOperation('thought-race');
    if (raceTime > 20) {
      recommendations.push({
        type: 'concurrency',
        priority: 'high',
        description: 'Thought racing is a bottleneck - implement parallel racing',
        estimatedImprovement: '50-70% race time reduction',
        implementation: 'Use Promise.allSettled for parallel thought evaluation'
      });
    }
    const memProfile = this.analyzeMemoryUsage();
    if (memProfile.totalHeapUsed > 100 * 1024 * 1024) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        description: 'High memory usage detected - implement packet pooling',
        estimatedImprovement: '30-50% memory reduction',
        implementation: 'Create object pools for NeuralPacket instances'
      });
    }
    const avgPacketTime = this.calculateAverage(this.packetProcessingTimes);
    if (avgPacketTime > 5) {
      recommendations.push({
        type: 'algorithm',
        priority: 'high',
        description: 'Packet processing is slow - optimize serialization',
        estimatedImprovement: '20-40% processing speedup',
        implementation: 'Use binary serialization instead of JSON for packet data'
      });
    }
    recommendations.push({
      type: 'caching',
      priority: 'medium',
      description: 'Implement attention pattern caching for repeated patterns',
      estimatedImprovement: '15-25% attention processing speedup',
      implementation: 'Cache interference calculations for similar packet patterns'
    });
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
  
  public autoOptimize(profile: PerformanceProfile): OptimizationResult {
    const applied: string[] = [];
    const failed: string[] = [];
    for (const rec of profile.recommendations) {
      if (rec.priority === 'critical' || rec.priority === 'high') {
        try {
          switch (rec.type) {
            case 'memory':
              this.applyMemoryOptimizations();
              applied.push(`Memory optimization: ${rec.description}`);
              break;
            case 'caching':
              this.applyCachingOptimizations();
              applied.push(`Caching optimization: ${rec.description}`);
              break;
            default:
              // TODO: Implement actual optimization strategies
              failed.push(`Manual implementation required: ${rec.description}`);
          }
        } catch (error) {
          failed.push(`Failed to apply: ${rec.description} - ${error}`);
        }
      }
    }
    
    return { applied, failed };
  }
  
  private applyMemoryOptimizations(): void {
    // TODO: Implement actual object pooling instead of just clearing
    for (const [operation, measurements] of this.measurements) {
      if (measurements.length > 1000) {
        measurements.splice(0, measurements.length - 500);
      }
    }
    if (this.packetProcessingTimes.length > 1000) {
      this.packetProcessingTimes.splice(0, this.packetProcessingTimes.length - 500);
    }
    
    if (this.consciousnessCycleTimes.length > 1000) {
      this.consciousnessCycleTimes.splice(0, this.consciousnessCycleTimes.length - 500);
    }
  }
  
  private applyCachingOptimizations(): void {
    // Enable garbage collection hints
    if (global.gc) {
      global.gc();
    }
  }
  
  /**
   * Reset all performance measurements
   */
  public reset(): void {
    this.measurements.clear();
    this.startTimes.clear();
    this.packetProcessingTimes = [];
    this.consciousnessCycleTimes = [];
  }
  
  /**
   * Export performance data for analysis
   */
  public exportData(): string {
    const data = {
      measurements: Object.fromEntries(this.measurements),
      packetProcessingTimes: this.packetProcessingTimes,
      consciousnessCycleTimes: this.consciousnessCycleTimes,
      timestamp: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }
}

export interface OptimizationResult {
  applied: string[];
  failed: string[];
}

// Global performance optimizer instance
export const performanceOptimizer = new PerformanceOptimizer();