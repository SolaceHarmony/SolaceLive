/**
 * @deprecated Use the new web-transformer.test.ts instead.
 * 
 * Simple tests for the TypeScript transformer implementation
 * 
 * MIGRATION: See src/web-transformer.test.ts for the new test suite
 */

import {
  StreamingTransformer,
  ProjectedTransformer,
  TransformerState,
  TensorUtils,
  Linear,
  type Tensor,
} from "./transformer";

// Test utilities
function assertArraysAlmostEqual(
  a: Float32Array,
  b: Float32Array,
  tolerance = 1e-6,
): void {
  if (a.length !== b.length) {
    throw new Error(
      `Arrays have different lengths: ${a.length} vs ${b.length}`,
    );
  }

  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tolerance) {
      throw new Error(`Arrays differ at index ${i}: ${a[i]} vs ${b[i]}`);
    }
  }
}

function assertShapesEqual(a: number[], b: number[]): void {
  if (a.length !== b.length) {
    throw new Error(`Shapes have different dimensions: [${a}] vs [${b}]`);
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      throw new Error(`Shapes differ at dimension ${i}: [${a}] vs [${b}]`);
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
  const arange = TensorUtils.arange(5);
  assertShapesEqual(arange.shape, [5]);
  assertArraysAlmostEqual(arange.data, new Float32Array([0, 1, 2, 3, 4]));

  // Test view
  const viewed = TensorUtils.view(arange, 1, 5);
  assertShapesEqual(viewed.shape, [1, 5]);
  assertArraysAlmostEqual(viewed.data, new Float32Array([0, 1, 2, 3, 4]));

  // Test add
  const a = {
    data: new Float32Array([1, 2, 3]),
    shape: [3],
    device: "cpu",
    dtype: "float32",
  };
  const b = {
    data: new Float32Array([4, 5, 6]),
    shape: [3],
    device: "cpu",
    dtype: "float32",
  };
  const sum = TensorUtils.add(a, b);
  assertArraysAlmostEqual(sum.data, new Float32Array([5, 7, 9]));

  // Test scale
  const scaled = TensorUtils.scale(a, 2);
  assertArraysAlmostEqual(scaled.data, new Float32Array([2, 4, 6]));

  console.log("✓ TensorUtils tests passed");
}

// Test TransformerState
function testTransformerState(): void {
  console.log("Testing TransformerState...");

  const state = new TransformerState(3);
  assertShapesEqual(state.offsets.shape, [3]);
  assertArraysAlmostEqual(state.offsets.data, new Float32Array([0, 0, 0]));

  // Test reset
  state.offsets.data[0] = 10;
  state.offsets.data[1] = 20;
  state.offsets.data[2] = 30;

  state.reset([true, false, true]);
  assertArraysAlmostEqual(state.offsets.data, new Float32Array([0, 20, 0]));

  console.log("✓ TransformerState tests passed");
}

// Test Linear layer
function testLinear(): void {
  console.log("Testing Linear layer...");

  const linear = new Linear(3, 2, false);

  // Test forward pass with known weights
  linear.weight.data.fill(0.5); // Simple test weights

  const input: Tensor = {
    data: new Float32Array([1, 2, 3, 4, 5, 6]), // 2 samples, 3 features each
    shape: [2, 3],
    device: "cpu",
    dtype: "float32",
  };

  const output = linear.forward(input);
  assertShapesEqual(output.shape, [2, 2]);

  // Expected: each output feature = sum(inputs) * 0.5
  // Sample 1: [1,2,3] -> [3*0.5, 3*0.5] = [1.5, 1.5]
  // Sample 2: [4,5,6] -> [7.5, 7.5]
  const expected = new Float32Array([3, 3, 7.5, 7.5]);
  assertArraysAlmostEqual(output.data, expected);

  console.log("✓ Linear layer tests passed");
}

// Test StreamingTransformer
function testStreamingTransformer(): void {
  console.log("Testing StreamingTransformer...");

  const transformer = new StreamingTransformer({
    dModel: 4,
    numHeads: 2,
    numLayers: 1,
    positionalEmbedding: "sin",
  });

  const input: Tensor = {
    data: new Float32Array(
      Array.from({ length: 2 * 3 * 4 }, (_, i) => i * 0.1),
    ), // [2, 3, 4]
    shape: [2, 3, 4], // batch=2, seq_len=3, dim=4
    device: "cpu",
    dtype: "float32",
  };

  const output = transformer.forward(input);
  assertShapesEqual(output.shape, [2, 3, 4]);

  console.log("✓ StreamingTransformer tests passed");
}

// Test ProjectedTransformer
function testProjectedTransformer(): void {
  console.log("Testing ProjectedTransformer...");

  const projTransformer = new ProjectedTransformer({
    inputDimension: 6,
    outputDimensions: [4, 8],
    dModel: 4,
    convLayout: false,
    transformerOptions: {
      numHeads: 2,
      numLayers: 1,
    },
  });

  const input: Tensor = {
    data: new Float32Array(
      Array.from({ length: 2 * 3 * 6 }, (_, i) => i * 0.1),
    ), // [2, 3, 6]
    shape: [2, 3, 6], // batch=2, seq_len=3, input_dim=6
    device: "cpu",
    dtype: "float32",
  };

  const outputs = projTransformer.forward(input);

  // Should have 2 outputs with dimensions [4, 8]
  if (outputs.length !== 2) {
    throw new Error(`Expected 2 outputs, got ${outputs.length}`);
  }

  assertShapesEqual(outputs[0].shape, [2, 3, 4]);
  assertShapesEqual(outputs[1].shape, [2, 3, 8]);

  console.log("✓ ProjectedTransformer tests passed");
}

// Test convolution layout
function testConvLayout(): void {
  console.log("Testing convolution layout...");

  const projTransformer = new ProjectedTransformer({
    inputDimension: 6,
    outputDimensions: [6],
    dModel: 6,
    convLayout: true,
    transformerOptions: {
      numHeads: 2,
      numLayers: 1,
    },
  });

  const input: Tensor = {
    data: new Float32Array(Array.from({ length: 2 * 6 * 3 }, (_, i) => i)), // [2, 6, 3] (B, C, T)
    shape: [2, 6, 3], // batch=2, channels=6, time=3
    device: "cpu",
    dtype: "float32",
  };

  const outputs = projTransformer.forward(input);
  assertShapesEqual(outputs[0].shape, [2, 6, 3]); // Should maintain B, C, T layout

  console.log("✓ Convolution layout tests passed");
}

// Run all tests
export function runTransformerTests(): void {
  console.log("Running TypeScript Transformer Tests...\n");

  try {
    testTensorUtils();
    testTransformerState();
    testLinear();
    testStreamingTransformer();
    testProjectedTransformer();
    testConvLayout();

    console.log("\n🎉 All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (typeof window === "undefined") {
  runTransformerTests();
}
