/**
 * @deprecated This custom transformer implementation is deprecated.
 * Please use the new Web-based transformer from './transformers/index.ts' instead.
 * 
 * TypeScript transliteration of the Python transformer module
 * Based on moshi/moshi/modules/transformer.py
 * 
 * MIGRATION: Replace imports with:
 * import { createTransformer, TensorUtils } from './transformers';
 */

// Basic tensor-like interface using TypedArrays
export interface Tensor {
  data: Float32Array;
  shape: number[];
  device?: string;
  dtype?: string;
}

// Utility functions for tensor operations
export class TensorUtils {
  static zeros(shape: number[], device?: string): Tensor {
    const size = shape.reduce((acc, dim) => acc * dim, 1);
    return {
      data: new Float32Array(size),
      shape: [...shape],
      device: device || "cpu",
      dtype: "float32",
    };
  }

  static arange(end: number, device?: string): Tensor {
    const data = new Float32Array(end);
    for (let i = 0; i < end; i++) {
      data[i] = i;
    }
    return {
      data,
      shape: [end],
      device: device || "cpu",
      dtype: "float32",
    };
  }

  static view(tensor: Tensor, ...newShape: number[]): Tensor {
    // Handle -1 in shape (infer dimension)
    let inferDim = -1;
    let knownSize = 1;

    for (let i = 0; i < newShape.length; i++) {
      if (newShape[i] === -1) {
        if (inferDim !== -1) {
          throw new Error("Only one dimension can be inferred");
        }
        inferDim = i;
      } else {
        knownSize *= newShape[i];
      }
    }

    const actualSize = tensor.data.length;
    const resolvedShape = [...newShape];

    if (inferDim !== -1) {
      resolvedShape[inferDim] = actualSize / knownSize;
    }

    const expectedSize = resolvedShape.reduce((acc, dim) => acc * dim, 1);

    if (expectedSize !== actualSize) {
      throw new Error(
        `Cannot reshape tensor of size ${actualSize} into shape [${resolvedShape}]`,
      );
    }

    return {
      data: tensor.data,
      shape: resolvedShape,
      device: tensor.device,
      dtype: tensor.dtype,
    };
  }

  static transpose(tensor: Tensor, dim0: number, dim1: number): Tensor {
    // For simplicity, only handle 3D tensors for now (B, T, C) <-> (B, C, T)
    if (tensor.shape.length !== 3) {
      throw new Error("Transpose currently only supports 3D tensors");
    }

    if ((dim0 === 1 && dim1 === 2) || (dim0 === 2 && dim1 === 1)) {
      const [B, T, C] = tensor.shape;
      const newData = new Float32Array(tensor.data.length);

      // Transpose from (B, T, C) to (B, C, T) or vice versa
      for (let b = 0; b < B; b++) {
        for (let t = 0; t < T; t++) {
          for (let c = 0; c < C; c++) {
            const srcIdx = b * T * C + t * C + c;
            const dstIdx = b * C * T + c * T + t;
            if (dim0 === 1 && dim1 === 2) {
              newData[dstIdx] = tensor.data[srcIdx];
            } else {
              newData[srcIdx] = tensor.data[dstIdx];
            }
          }
        }
      }

      return {
        data: newData,
        shape: dim0 === 1 && dim1 === 2 ? [B, C, T] : [B, T, C],
        device: tensor.device,
        dtype: tensor.dtype,
      };
    }

    throw new Error(`Transpose dims ${dim0}, ${dim1} not implemented`);
  }

  static add(a: Tensor, b: Tensor): Tensor {
    if (a.data.length !== b.data.length) {
      throw new Error("Tensors must have same size for addition");
    }

    const result = new Float32Array(a.data.length);
    for (let i = 0; i < a.data.length; i++) {
      result[i] = a.data[i] + b.data[i];
    }

    return {
      data: result,
      shape: [...a.shape],
      device: a.device,
      dtype: a.dtype,
    };
  }

  static scale(tensor: Tensor, scalar: number): Tensor {
    const result = new Float32Array(tensor.data.length);
    for (let i = 0; i < tensor.data.length; i++) {
      result[i] = tensor.data[i] * scalar;
    }

    return {
      data: result,
      shape: [...tensor.shape],
      device: tensor.device,
      dtype: tensor.dtype,
    };
  }
}

// State interface for streaming
export interface State {
  batchSize: number;
  device: string;
  execMask?: boolean[];
  reset(resetMask: boolean[]): void;
}

// Transformer state implementation
export class TransformerState implements State {
  batchSize: number;
  device: string;
  offsets: Tensor;
  execMask?: boolean[];

  constructor(batchSize: number, device: string = "cpu", offsets?: Tensor) {
    this.batchSize = batchSize;
    this.device = device;
    this.offsets = offsets || TensorUtils.zeros([batchSize], device);
  }

  reset(resetMask: boolean[]): void {
    // Reset offsets where resetMask is true
    for (let i = 0; i < resetMask.length && i < this.offsets.data.length; i++) {
      if (resetMask[i]) {
        this.offsets.data[i] = 0;
      }
    }
  }
}

// Base streaming module interface
export interface StreamingModule<T extends State> {
  streamingState?: T;
  forward(x: Tensor, ...args: any[]): Tensor;
  initStreamingState(batchSize: number): T;
}

// Positional embedding utilities
export class PositionalEmbedding {
  static createSinEmbedding(
    positions: Tensor,
    dim: number,
    maxPeriod: number = 10000,
  ): Tensor {
    const [batchSize, seqLen] = positions.shape;
    const embeddings = TensorUtils.zeros([batchSize, seqLen, dim]);

    for (let b = 0; b < batchSize; b++) {
      for (let t = 0; t < seqLen; t++) {
        const pos = positions.data[b * seqLen + t];
        for (let d = 0; d < dim; d += 2) {
          const angle = pos / Math.pow(maxPeriod, d / dim);
          const idx = b * seqLen * dim + t * dim;
          embeddings.data[idx + d] = Math.sin(angle);
          if (d + 1 < dim) {
            embeddings.data[idx + d + 1] = Math.cos(angle);
          }
        }
      }
    }

    return embeddings;
  }
}

// Linear layer implementation
export class Linear {
  weight: Tensor;
  bias?: Tensor;
  inFeatures: number;
  outFeatures: number;

  constructor(inFeatures: number, outFeatures: number, bias: boolean = true) {
    this.inFeatures = inFeatures;
    this.outFeatures = outFeatures;

    // Initialize with small random values (simplified Xavier initialization)
    const weightData = new Float32Array(inFeatures * outFeatures);
    const scale = Math.sqrt(2.0 / (inFeatures + outFeatures));
    for (let i = 0; i < weightData.length; i++) {
      weightData[i] = (Math.random() - 0.5) * 2 * scale;
    }

    this.weight = {
      data: weightData,
      shape: [outFeatures, inFeatures],
      device: "cpu",
      dtype: "float32",
    };

    if (bias) {
      this.bias = TensorUtils.zeros([outFeatures]);
    }
  }

  forward(x: Tensor): Tensor {
    // Simple matrix multiplication for last dimension
    const inputShape = x.shape;
    const batchSize = inputShape
      .slice(0, -1)
      .reduce((acc, dim) => acc * dim, 1);
    const result = TensorUtils.zeros([
      ...inputShape.slice(0, -1),
      this.outFeatures,
    ]);

    for (let b = 0; b < batchSize; b++) {
      for (let out = 0; out < this.outFeatures; out++) {
        let sum = 0;
        for (let inp = 0; inp < this.inFeatures; inp++) {
          const xIdx = b * this.inFeatures + inp;
          const wIdx = out * this.inFeatures + inp;
          sum += x.data[xIdx] * this.weight.data[wIdx];
        }
        if (this.bias) {
          sum += this.bias.data[out];
        }
        result.data[b * this.outFeatures + out] = sum;
      }
    }

    return result;
  }
}

// Identity layer
export class Identity {
  forward(x: Tensor): Tensor {
    return {
      data: new Float32Array(x.data),
      shape: [...x.shape],
      device: x.device,
      dtype: x.dtype,
    };
  }
}

// Streaming Transformer implementation
export class StreamingTransformer implements StreamingModule<TransformerState> {
  dModel: number;
  numHeads: number;
  numLayers: number;
  dimFeedforward: number | number[];
  causal: boolean;
  context?: number;
  positionalEmbedding: string;
  maxPeriod: number;
  positionalScale: number;
  checkpointing: boolean;
  layers: any[]; // Simplified for now
  streamingState?: TransformerState;

  constructor(options: {
    dModel: number;
    numHeads: number;
    numLayers: number;
    dimFeedforward?: number | number[];
    causal?: boolean;
    context?: number;
    positionalEmbedding?: string;
    maxPeriod?: number;
    positionalScale?: number;
    checkpointing?: boolean;
    device?: string;
    dtype?: string;
  }) {
    this.dModel = options.dModel;
    this.numHeads = options.numHeads;
    this.numLayers = options.numLayers;
    this.dimFeedforward = options.dimFeedforward || 2048;
    this.causal = options.causal || false;
    this.context = options.context;
    this.positionalEmbedding = options.positionalEmbedding || "sin";
    this.maxPeriod = options.maxPeriod || 10000;
    this.positionalScale = options.positionalScale || 1.0;
    this.checkpointing = options.checkpointing || false;

    // Validate positional embedding type
    const validEmbeddings = new Set(["sin", "rope", "sin_rope", "none"]);
    if (!validEmbeddings.has(this.positionalEmbedding)) {
      throw new Error(
        `Invalid positional embedding: ${this.positionalEmbedding}`,
      );
    }

    // Initialize layers (simplified)
    this.layers = [];
    for (let i = 0; i < this.numLayers; i++) {
      // For now, we'll use identity layers as placeholders
      // In a full implementation, these would be transformer layers
      this.layers.push(new Identity());
    }
  }

  forward(x: Tensor): Tensor {
    const [B, T, C] = x.shape;
    const dtypeInput = x.dtype;

    let state = this.streamingState;
    let offsets: Tensor;

    if (!state) {
      offsets = TensorUtils.zeros([1], x.device);
    } else {
      offsets = state.offsets;
    }

    // Apply positional embeddings
    if (
      this.positionalEmbedding === "sin" ||
      this.positionalEmbedding === "sin_rope"
    ) {
      const positions = TensorUtils.arange(T, x.device);
      const positionsReshaped = TensorUtils.view(positions, 1, T, 1);

      // Add offsets to positions (broadcast add)
      for (let b = 0; b < B; b++) {
        for (let t = 0; t < T; t++) {
          const offsetIdx = Math.min(b, offsets.data.length - 1);
          const posIdx = t;
          const destIdx = b * T + t;
          positionsReshaped.data[destIdx] = posIdx + offsets.data[offsetIdx];
        }
      }

      // Expand positions to match batch size
      const expandedPositions = TensorUtils.zeros([B, T], x.device);
      for (let b = 0; b < B; b++) {
        for (let t = 0; t < T; t++) {
          const offsetIdx = Math.min(b, offsets.data.length - 1);
          expandedPositions.data[b * T + t] = t + offsets.data[offsetIdx];
        }
      }

      const posEmb = PositionalEmbedding.createSinEmbedding(
        expandedPositions,
        C,
        this.maxPeriod,
      );

      const scaledPosEmb = TensorUtils.scale(posEmb, this.positionalScale);
      x = TensorUtils.add(x, scaledPosEmb);
    }

    // Forward through layers
    for (const layer of this.layers) {
      x = layer.forward(x);
    }

    // Update state if streaming
    if (state) {
      // Update offsets (simplified)
      for (let i = 0; i < state.offsets.data.length; i++) {
        if (!state.execMask || state.execMask[i]) {
          state.offsets.data[i] += T;
        }
      }
    }

    return {
      data: x.data,
      shape: x.shape,
      device: x.device,
      dtype: dtypeInput,
    };
  }

  initStreamingState(batchSize: number): TransformerState {
    return new TransformerState(batchSize, "cpu");
  }
}

// Projected Transformer implementation
export class ProjectedTransformer {
  transformer: StreamingTransformer;
  inputProj?: Linear;
  outputProjs: (Linear | Identity)[];
  convLayout: boolean;

  constructor(options: {
    inputDimension: number;
    outputDimensions: number[];
    dModel: number;
    convLayout?: boolean;
    transformerOptions?: any;
  }) {
    const {
      inputDimension,
      outputDimensions,
      dModel,
      convLayout = false,
      transformerOptions = {},
    } = options;

    this.convLayout = convLayout;

    // Create transformer
    this.transformer = new StreamingTransformer({
      dModel,
      ...transformerOptions,
    });

    // Input projection
    if (dModel !== inputDimension) {
      this.inputProj = new Linear(inputDimension, dModel, false);
    }

    // Output projections
    this.outputProjs = [];
    for (const outputDimension of outputDimensions) {
      if (dModel === outputDimension) {
        this.outputProjs.push(new Identity());
      } else {
        this.outputProjs.push(new Linear(dModel, outputDimension, false));
      }
    }
  }

  forward(x: Tensor): Tensor[] {
    // Handle convolution layout
    if (this.convLayout) {
      x = TensorUtils.transpose(x, 1, 2);
    }

    // Apply input projection
    if (this.inputProj) {
      x = this.inputProj.forward(x);
    }

    // Forward through transformer
    const z = this.transformer.forward(x);

    // Apply output projections
    const ys: Tensor[] = [];
    for (const outputProj of this.outputProjs) {
      let y = outputProj.forward(z);

      // Handle convolution layout
      if (this.convLayout) {
        y = TensorUtils.transpose(y, 1, 2);
      }

      ys.push(y);
    }

    return ys;
  }
}
