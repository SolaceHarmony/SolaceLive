/**
 * Server-side transformer implementation using Node.js
 * Adapted from client-side transformers for server-side usage
 * 
 * This implementation aligns with the architectural design making React/TypeScript
 * a first-class citizen by providing a TypeScript server counterpart
 * 
 * Note: This version uses a simplified approach without TensorFlow.js
 * for easier deployment and compatibility. Can be extended with ML libraries.
 */

// Server-side tensor interface compatible with standard ML libraries
export interface ServerTensor {
  data: Float32Array | Int32Array | Float64Array;
  shape: number[];
  device?: 'cpu' | 'gpu';
  dtype?: 'float32' | 'int32' | 'float64' | 'float16';
}

// Configuration for server-side transformer models
export interface ServerTransformerConfig {
  modelSize: 'small' | 'base' | 'large';
  task: 'text-generation' | 'audio-processing' | 'multimodal';
  device: 'cpu' | 'gpu';
  precision: 'float32' | 'float16';
  maxContextLength?: number;
  batchSize?: number;
}

// Server-side streaming state interface
export interface ServerStreamingState {
  batchSize: number;
  offsets: ServerTensor;
  execMask?: boolean[];
  reset(resetMask?: boolean[]): void;
}

// Server-side streaming state implementation
export class NodeStreamingState implements ServerStreamingState {
  batchSize: number;
  offsets: ServerTensor;
  execMask?: boolean[];

  constructor(batchSize: number, device: 'cpu' | 'gpu' = 'cpu') {
    this.batchSize = batchSize;
    this.offsets = ServerTensorUtils.zeros([batchSize], 'int32', device);
  }

  reset(resetMask?: boolean[]): void {
    if (!resetMask) {
      // Reset all offsets to 0
      this.offsets.data.fill(0);
      return;
    }

    // Reset specific offsets where resetMask is true
    for (let i = 0; i < resetMask.length && i < this.offsets.data.length; i++) {
      if (resetMask[i]) {
        this.offsets.data[i] = 0;
      }
    }
  }
}

// Server-side transformer using standard JavaScript/TypeScript
export class NodeTransformer {
  private config: ServerTransformerConfig;
  private initialized: boolean = false;

  constructor(config: ServerTransformerConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log(`Initializing Node.js Transformer with config:`, this.config);
    
    // Simulate async initialization (model loading, etc.)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.initialized = true;
    console.log('Node.js Transformer initialized successfully');
  }

  private getModelDimension(): number {
    switch (this.config.modelSize) {
      case 'small': return 128;
      case 'base': return 256;
      case 'large': return 512;
      default: return 256;
    }
  }

  forward(input: ServerTensor): ServerTensor {
    if (!this.initialized) {
      throw new Error('Transformer not initialized. Call initialize() first.');
    }

    // Simple mock transformer forward pass
    // In production, this would run actual ML inference
    const outputData = new Float32Array(input.data.length);
    
    // Simple transformation: apply a small random transformation
    for (let i = 0; i < input.data.length; i++) {
      outputData[i] = input.data[i] + Math.sin(i * 0.1) * 0.1;
    }
    
    const result: ServerTensor = {
      data: outputData,
      shape: [...input.shape],
      device: input.device,
      dtype: input.dtype
    };
    
    return result;
  }

  createStreamingState(batchSize: number): NodeStreamingState {
    return new NodeStreamingState(batchSize, this.config.device);
  }

  dispose(): void {
    // Clean up resources
    this.initialized = false;
  }
}

// Utility functions for server-side tensor operations
export class ServerTensorUtils {
  static zeros(shape: number[], dtype: 'float32' | 'int32' | 'float64' = 'float32', device: 'cpu' | 'gpu' = 'cpu'): ServerTensor {
    const size = shape.reduce((acc, dim) => acc * dim, 1);
    let data: Float32Array | Int32Array | Float64Array;
    
    switch (dtype) {
      case 'int32':
        data = new Int32Array(size);
        break;
      case 'float64':
        data = new Float64Array(size);
        break;
      default:
        data = new Float32Array(size);
    }
    
    return {
      data,
      shape: [...shape],
      device,
      dtype
    };
  }

  static arange(start: number, stop: number, step: number = 1, dtype: 'float32' | 'int32' | 'float64' = 'float32', device: 'cpu' | 'gpu' = 'cpu'): ServerTensor {
    const length = Math.ceil((stop - start) / step);
    const shape = [length];
    
    let data: Float32Array | Int32Array | Float64Array;
    
    switch (dtype) {
      case 'int32':
        data = new Int32Array(length);
        break;
      case 'float64':
        data = new Float64Array(length);
        break;
      default:
        data = new Float32Array(length);
    }
    
    for (let i = 0; i < length; i++) {
      data[i] = start + i * step;
    }
    
    return {
      data,
      shape,
      device,
      dtype
    };
  }

  static reshape(tensor: ServerTensor, newShape: number[]): ServerTensor {
    const expectedSize = newShape.reduce((acc, dim) => acc * dim, 1);
    const actualSize = tensor.data.length;
    
    if (expectedSize !== actualSize) {
      throw new Error(
        `Cannot reshape tensor of size ${actualSize} into shape [${newShape}]`
      );
    }
    
    return {
      data: tensor.data,
      shape: [...newShape],
      device: tensor.device,
      dtype: tensor.dtype
    };
  }

  static add(a: ServerTensor, b: ServerTensor): ServerTensor {
    if (a.data.length !== b.data.length) {
      throw new Error('Tensors must have same size for addition');
    }
    
    const result = new Float32Array(a.data.length);
    for (let i = 0; i < a.data.length; i++) {
      result[i] = a.data[i] + b.data[i];
    }
    
    return {
      data: result,
      shape: [...a.shape],
      device: a.device,
      dtype: a.dtype
    };
  }

  static scale(tensor: ServerTensor, scalar: number): ServerTensor {
    const result = new Float32Array(tensor.data.length);
    for (let i = 0; i < tensor.data.length; i++) {
      result[i] = tensor.data[i] * scalar;
    }
    
    return {
      data: result,
      shape: [...tensor.shape],
      device: tensor.device,
      dtype: tensor.dtype
    };
  }
}

// Factory function for creating server-side transformers
export async function createServerTransformer(config: ServerTransformerConfig): Promise<NodeTransformer> {
  const transformer = new NodeTransformer(config);
  await transformer.initialize();
  return transformer;
}

// Default export for easy importing
export default {
  NodeTransformer,
  NodeStreamingState,
  ServerTensorUtils,
  createServerTransformer
};