/**
 * @deprecated Use the new web-transformer-examples.ts instead.
 * 
 * Example usage of the TypeScript transformer implementation
 * This demonstrates how to use the translated transformer classes
 * 
 * MIGRATION: See src/web-transformer-examples.ts for the new API
 */

import {
  StreamingTransformer,
  ProjectedTransformer,
  TensorUtils,
  type Tensor,
} from "./transformer";

// Example 1: Basic StreamingTransformer usage
function basicTransformerExample(): void {
  console.log("=== Basic StreamingTransformer Example ===");

  // Create a simple transformer
  const transformer = new StreamingTransformer({
    dModel: 8, // Model dimension
    numHeads: 2, // Number of attention heads
    numLayers: 2, // Number of transformer layers
    positionalEmbedding: "sin", // Sinusoidal positional encoding
    causal: true, // Causal mask for autoregressive generation
  });

  // Create sample input: batch_size=2, seq_len=4, dim=8
  const input: Tensor = {
    data: new Float32Array(Array.from({ length: 64 }, (_, i) => i * 0.01)),
    shape: [2, 4, 8],
    device: "cpu",
    dtype: "float32",
  };

  console.log("Input shape:", input.shape);
  console.log("Input data (first 8 values):", Array.from(input.data.slice(0, 8)));

  // Forward pass
  const output = transformer.forward(input);

  console.log("Output shape:", output.shape);
  console.log(
    "Output data (first 8 values):",
    Array.from(output.data.slice(0, 8)),
  );
}

// Example 2: ProjectedTransformer with multiple outputs
function projectedTransformerExample(): void {
  console.log("\n=== ProjectedTransformer Example ===");

  // Create a projected transformer with different input/output dimensions
  const projTransformer = new ProjectedTransformer({
    inputDimension: 12, // Input has 12 features
    outputDimensions: [6, 8, 10], // Three different output dimensions
    dModel: 16, // Internal transformer dimension
    convLayout: false, // Use sequence-first layout [B, T, C]
    transformerOptions: {
      numHeads: 4,
      numLayers: 3,
      positionalEmbedding: "sin",
      causal: false, // Non-causal (encoder-style)
    },
  });

  // Create sample input with shape [batch=1, seq_len=5, input_dim=12]
  const input: Tensor = {
    data: new Float32Array(Array.from({ length: 60 }, (_, i) => Math.sin(i * 0.1))),
    shape: [1, 5, 12],
    device: "cpu",
    dtype: "float32",
  };

  console.log("Input shape:", input.shape);

  // Forward pass - returns multiple outputs
  const outputs = projTransformer.forward(input);

  console.log("Number of outputs:", outputs.length);
  outputs.forEach((output, i) => {
    console.log(`Output ${i} shape:`, output.shape);
  });
}

// Example 3: Convolution layout (channel-first)
function convLayoutExample(): void {
  console.log("\n=== Convolution Layout Example ===");

  const convTransformer = new ProjectedTransformer({
    inputDimension: 64, // 64 channels
    outputDimensions: [32, 64], // Two outputs with different channel counts
    dModel: 128,
    convLayout: true, // Use channel-first layout [B, C, T]
    transformerOptions: {
      numHeads: 8,
      numLayers: 2,
      positionalEmbedding: "none", // No positional encoding for conv-like data
    },
  });

  // Input with shape [batch=1, channels=64, time=10]
  const input: Tensor = {
    data: new Float32Array(640).fill(0).map(() => Math.random() * 0.1),
    shape: [1, 64, 10],
    device: "cpu",
    dtype: "float32",
  };

  console.log("Input shape (B, C, T):", input.shape);

  const outputs = convTransformer.forward(input);
  
  console.log("Outputs:");
  outputs.forEach((output, i) => {
    console.log(`  Output ${i} shape (B, C, T):`, output.shape);
  });
}

// Example 4: Streaming state management
function streamingStateExample(): void {
  console.log("\n=== Streaming State Example ===");

  const transformer = new StreamingTransformer({
    dModel: 16,
    numHeads: 4,
    numLayers: 2,
    positionalEmbedding: "sin",
    causal: true,
  });

  const batchSize = 2;
  
  // Initialize streaming state
  transformer.streamingState = transformer.initStreamingState(batchSize);
  
  console.log("Initial offsets:", Array.from(transformer.streamingState.offsets.data));

  // Process first chunk
  const chunk1: Tensor = {
    data: new Float32Array(Array.from({ length: 32 }, (_, i) => i * 0.02)),
    shape: [2, 1, 16], // batch=2, seq_len=1, dim=16
    device: "cpu",
    dtype: "float32",
  };

  transformer.forward(chunk1);
  console.log("After chunk 1, offsets:", Array.from(transformer.streamingState.offsets.data));

  // Process second chunk
  const chunk2: Tensor = {
    data: new Float32Array(Array.from({ length: 64 }, (_, i) => (i + 32) * 0.02)),
    shape: [2, 2, 16], // batch=2, seq_len=2, dim=16
    device: "cpu",
    dtype: "float32",
  };

  transformer.forward(chunk2);
  console.log("After chunk 2, offsets:", Array.from(transformer.streamingState.offsets.data));
}

// Example 5: Tensor utilities demonstration
function tensorUtilitiesExample(): void {
  console.log("\n=== Tensor Utilities Example ===");

  // Create and manipulate tensors
  const a = TensorUtils.zeros([2, 3]);
  console.log("Zeros tensor:", a.shape, Array.from(a.data));

  const b = TensorUtils.arange(6);
  console.log("Arange tensor:", b.shape, Array.from(b.data));

  const reshaped = TensorUtils.view(b, 2, 3);
  console.log("Reshaped tensor:", reshaped.shape, Array.from(reshaped.data));

  const c = TensorUtils.view(TensorUtils.arange(6), 2, 3);
  const d = TensorUtils.view(TensorUtils.arange(6), 2, 3);
  const sum = TensorUtils.add(c, d);
  console.log("Sum tensor:", sum.shape, Array.from(sum.data));

  const scaled = TensorUtils.scale(sum, 0.5);
  console.log("Scaled tensor:", scaled.shape, Array.from(scaled.data));

  // Test transpose
  const tensor3d: Tensor = {
    data: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    shape: [2, 2, 3], // B=2, T=2, C=3
    device: "cpu",
    dtype: "float32",
  };
  
  const transposed = TensorUtils.transpose(tensor3d, 1, 2);
  console.log("Original shape (B, T, C):", tensor3d.shape);
  console.log("Transposed shape (B, C, T):", transposed.shape);
  console.log("Original data:", Array.from(tensor3d.data));
  console.log("Transposed data:", Array.from(transposed.data));
}

// Run all examples
export function runTransformerExamples(): void {
  console.log("TypeScript Transformer Examples\n");
  
  try {
    basicTransformerExample();
    projectedTransformerExample();
    convLayoutExample();
    streamingStateExample();
    tensorUtilitiesExample();
    
    console.log("\n✅ All examples completed successfully!");
  } catch (error) {
    console.error("\n❌ Example failed:", error);
    throw error;
  }
}

// Run examples if this file is executed directly
if (typeof window === "undefined") {
  runTransformerExamples();
}