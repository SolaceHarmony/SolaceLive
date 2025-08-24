/**
 * Example usage of the Web-based transformer implementation
 * This demonstrates how to use the new standard transformer API
 */

import {
  TensorUtils,
  createTransformer,
  type Tensor,
  type TransformerConfig,
} from "./transformers/index";

// Example 1: Basic Web Transformer usage
async function basicWebTransformerExample(): Promise<void> {
  console.log("=== Basic Web Transformer Example ===");

  const config: TransformerConfig = {
    modelSize: "base",
    task: "text-generation",
    device: "cpu",
    precision: "float32",
  };

  // Create transformer using the factory function
  const transformer = await createTransformer(config);

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

// Example 2: Audio Processing Transformer
async function audioProcessingExample(): Promise<void> {
  console.log("=== Audio Processing Transformer Example ===");

  const config: TransformerConfig = {
    modelSize: "small",
    task: "audio-processing",
    device: "cpu",
    precision: "float32",
  };

  const transformer = await createTransformer(config);

  // Simulate audio input: 1 batch, 1000 samples, 1 channel
  const audioInput: Tensor = {
    data: new Float32Array(1000).map(() => Math.sin(Math.random() * Math.PI * 2) * 0.1),
    shape: [1, 1000, 1],
    device: "cpu",
    dtype: "float32",
  };

  console.log("Audio input shape:", audioInput.shape);
  
  const processedAudio = transformer.forward(audioInput);
  
  console.log("Processed audio shape:", processedAudio.shape);
  console.log("Audio processing complete");
}

// Example 3: Streaming State Management
async function streamingStateExample(): Promise<void> {
  console.log("=== Streaming State Management Example ===");

  const config: TransformerConfig = {
    modelSize: "base",
    task: "text-generation",
    device: "cpu",
  };

  const transformer = await createTransformer(config);
  const batchSize = 3;
  const streamingState = transformer.createStreamingState(batchSize);

  console.log("Initial streaming state batch size:", streamingState.batchSize);
  console.log("Initial offsets:", Array.from(streamingState.offsets.data));

  // Simulate some processing that updates offsets
  streamingState.offsets.data[0] = 10;
  streamingState.offsets.data[1] = 20;
  streamingState.offsets.data[2] = 30;
  
  console.log("After updates:", Array.from(streamingState.offsets.data));

  // Reset some states
  streamingState.reset([true, false, true]);
  console.log("After selective reset:", Array.from(streamingState.offsets.data));

  // Reset all states
  streamingState.reset();
  console.log("After full reset:", Array.from(streamingState.offsets.data));
}

// Example 4: Tensor Utilities Demonstration
function tensorUtilitiesExample(): void {
  console.log("=== Tensor Utilities Example ===");

  // Create zero tensor
  const zeros = TensorUtils.zeros([2, 3, 4]);
  console.log("Zeros tensor shape:", zeros.shape);
  console.log("Zeros data (first 5 values):", Array.from(zeros.data.slice(0, 5)));

  // Create range tensor
  const range = TensorUtils.arange(0, 10, 1);
  console.log("Range tensor shape:", range.shape);
  console.log("Range data:", Array.from(range.data));

  // Tensor addition
  const a = TensorUtils.arange(0, 6, 1);
  const b = TensorUtils.arange(6, 12, 1);
  const sum = TensorUtils.add(a, b);
  console.log("Sum result:", Array.from(sum.data));

  // Tensor scaling
  const scaled = TensorUtils.scale(a, 2.5);
  console.log("Scaled result:", Array.from(scaled.data));

  // Tensor reshaping
  const reshaped = TensorUtils.reshape(a, [2, 3]);
  console.log("Reshaped tensor shape:", reshaped.shape);
  console.log("Reshaped data:", Array.from(reshaped.data));
}

// Example 5: WebGPU Detection (if available)
async function webGpuExample(): Promise<void> {
  console.log("=== WebGPU Detection Example ===");

  const config: TransformerConfig = {
    modelSize: "small",
    task: "text-generation",
    device: "gpu", // Try to use GPU
    precision: "float32",
  };

  try {
    const transformer = await createTransformer(config);
    console.log("Transformer created successfully with GPU config");
    
    const input = TensorUtils.zeros([1, 10, 64]);
    const output = transformer.forward(input);
    console.log("GPU inference completed, output shape:", output.shape);
  } catch (error) {
    console.log("GPU initialization failed:", error);
  }
}

// Run all examples
export async function runWebTransformerExamples(): Promise<void> {
  console.log("Web-based Transformer Examples\n");
  
  try {
    await basicWebTransformerExample();
    console.log("");
    
    await audioProcessingExample();
    console.log("");
    
    await streamingStateExample();
    console.log("");
    
    tensorUtilitiesExample();
    console.log("");
    
    await webGpuExample();
    
    console.log("\n✅ All examples completed successfully!");
  } catch (error) {
    console.error("\n❌ Example failed:", error);
    throw error;
  }
}

// Run examples if this file is executed directly
if (typeof window === "undefined") {
  runWebTransformerExamples().catch(console.error);
}