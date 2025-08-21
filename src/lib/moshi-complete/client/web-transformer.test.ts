/**
 * Tests for the Web-based transformer implementation
 */

import {
  WebStreamingState,
  TensorUtils,
  createTransformer,
  type Tensor,
  type TransformerConfig,
} from "./transformers/index";

// Test utilities
function assertArraysAlmostEqual(
  a: Float32Array | Float64Array | Int32Array,
  b: Float32Array | Float64Array | Int32Array,
  tolerance = 1e-6,
): void {
  if (a.length !== b.length) {
    throw new Error(`Array lengths don't match: ${a.length} vs ${b.length}`);
  }
  
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    if (diff > tolerance) {
      throw new Error(`Arrays differ at index ${i}: ${a[i]} vs ${b[i]} (diff: ${diff})`);
    }
  }
}

function assertShapesEqual(a: number[], b: number[]): void {
  if (a.length !== b.length) {
    throw new Error(`Shape lengths don't match: [${a.join(', ')}] vs [${b.join(', ')}]`);
  }
  
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      throw new Error(`Shapes differ at index ${i}: [${a.join(', ')}] vs [${b.join(', ')}]`);
    }
  }
}

// Test TensorUtils
function testTensorUtils(): void {
  console.log("Testing TensorUtils...");

  // Test zeros
  const zeros = TensorUtils.zeros([2, 3]);
  assertShapesEqual(zeros.shape, [2, 3]);
  assertArraysAlmostEqual(zeros.data, new Float32Array([0, 0, 0, 0, 0, 0]));

  // Test arange
  const range = TensorUtils.arange(0, 5, 1);
  assertShapesEqual(range.shape, [5]);
  assertArraysAlmostEqual(range.data, new Float32Array([0, 1, 2, 3, 4]));

  // Test add
  const a = {
    data: new Float32Array([1, 2, 3]),
    shape: [3],
    device: "cpu" as const,
    dtype: "float32" as const,
  };
  const b = {
    data: new Float32Array([4, 5, 6]),
    shape: [3],
    device: "cpu" as const,
    dtype: "float32" as const,
  };
  const sum = TensorUtils.add(a, b);
  assertArraysAlmostEqual(sum.data, new Float32Array([5, 7, 9]));

  // Test scale
  const scaled = TensorUtils.scale(a, 2);
  assertArraysAlmostEqual(scaled.data, new Float32Array([2, 4, 6]));

  // Test reshape
  const tensor = TensorUtils.arange(0, 12, 1);
  const reshaped = TensorUtils.reshape(tensor, [3, 4]);
  assertShapesEqual(reshaped.shape, [3, 4]);
  assertArraysAlmostEqual(reshaped.data, tensor.data);

  console.log("✓ TensorUtils tests passed");
}

// Test WebStreamingState
function testWebStreamingState(): void {
  console.log("Testing WebStreamingState...");

  const state = new WebStreamingState(3);
  assertShapesEqual(state.offsets.shape, [3]);
  assertArraysAlmostEqual(state.offsets.data, new Float32Array([0, 0, 0]));

  // Test reset with values
  state.offsets.data[0] = 10;
  state.offsets.data[1] = 20;
  state.offsets.data[2] = 30;

  state.reset([true, false, true]);
  assertArraysAlmostEqual(state.offsets.data, new Float32Array([0, 20, 0]));

  // Test full reset
  state.reset();
  assertArraysAlmostEqual(state.offsets.data, new Float32Array([0, 0, 0]));

  console.log("✓ WebStreamingState tests passed");
}

// Test WebTransformer
async function testWebTransformer(): Promise<void> {
  console.log("Testing WebTransformer...");

  const config: TransformerConfig = {
    modelSize: "small",
    task: "text-generation",
    device: "cpu",
    precision: "float32",
  };

  const transformer = await createTransformer(config);

  // Test forward pass
  const input: Tensor = {
    data: new Float32Array([1, 2, 3, 4, 5, 6]),
    shape: [2, 3],
    device: "cpu",
    dtype: "float32",
  };

  const output = transformer.forward(input);
  assertShapesEqual(output.shape, input.shape);
  
  // For the identity transformation, output should equal input
  assertArraysAlmostEqual(output.data, input.data);

  // Test streaming state creation
  const streamingState = transformer.createStreamingState(2);
  assertShapesEqual(streamingState.offsets.shape, [2]);

  console.log("✓ WebTransformer tests passed");
}

// Test error conditions
function testErrorConditions(): void {
  console.log("Testing error conditions...");

  // Test mismatched tensor shapes for addition
  const a = TensorUtils.zeros([2, 3]);
  const b = TensorUtils.zeros([3, 2]);
  
  try {
    TensorUtils.add(a, b);
    throw new Error("Expected error for mismatched shapes");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("must match")) {
      throw error;
    }
  }

  // Test invalid reshape
  const tensor = TensorUtils.zeros([2, 3]); // 6 elements
  try {
    TensorUtils.reshape(tensor, [2, 2]); // 4 elements
    throw new Error("Expected error for invalid reshape");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Cannot reshape")) {
      throw error;
    }
  }

  console.log("✓ Error condition tests passed");
}

// Test different data types
function testDataTypes(): void {
  console.log("Testing different data types...");

  // Test int32 tensors
  const intTensor = TensorUtils.zeros([3], "int32");
  if (!(intTensor.data instanceof Int32Array)) {
    throw new Error("Expected Int32Array for int32 dtype");
  }

  // Test float64 tensors
  const doubleTensor = TensorUtils.zeros([3], "float64");
  if (!(doubleTensor.data instanceof Float64Array)) {
    throw new Error("Expected Float64Array for float64 dtype");
  }

  // Test arange with different dtypes
  const intRange = TensorUtils.arange(0, 5, 1, "int32");
  if (!(intRange.data instanceof Int32Array)) {
    throw new Error("Expected Int32Array for int32 arange");
  }
  assertArraysAlmostEqual(intRange.data, new Int32Array([0, 1, 2, 3, 4]));

  console.log("✓ Data type tests passed");
}

// Run all tests
export async function runWebTransformerTests(): Promise<void> {
  console.log("Running Web-based Transformer Tests...\n");

  try {
    testTensorUtils();
    testWebStreamingState();
    testDataTypes();
    testErrorConditions();
    await testWebTransformer();

    console.log("\n🎉 All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (typeof window === "undefined") {
  runWebTransformerTests().catch(console.error);
}