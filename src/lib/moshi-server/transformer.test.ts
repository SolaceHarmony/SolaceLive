/**
 * Tests for the server-side transformer implementation
 */

import {
  NodeTransformer,
  NodeStreamingState,
  ServerTensorUtils,
  createServerTransformer,
  type ServerTensor,
  type ServerTransformerConfig,
} from './transformers/index.js';

// Test utilities
function assertArraysAlmostEqual(
  a: Float32Array | Float64Array | Int32Array,
  b: Float32Array | Float64Array | Int32Array,
  tolerance = 1e-6,
): void {
  if (a.length !== b.length) {
    throw new Error(`Array lengths differ: ${a.length} vs ${b.length}`);
  }

  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    if (diff > tolerance) {
      throw new Error(
        `Arrays differ at index ${i}: ${a[i]} vs ${b[i]} (diff: ${diff})`
      );
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

// Test ServerTensorUtils
function testServerTensorUtils(): void {
  console.log('Testing ServerTensorUtils...');

  // Test zeros
  const zeros = ServerTensorUtils.zeros([2, 3], 'float32', 'cpu');
  assertShapesEqual(zeros.shape, [2, 3]);
  assertArraysAlmostEqual(zeros.data, new Float32Array([0, 0, 0, 0, 0, 0]));

  // Test arange
  const arange = ServerTensorUtils.arange(0, 5, 1, 'float32', 'cpu');
  assertShapesEqual(arange.shape, [5]);
  assertArraysAlmostEqual(arange.data, new Float32Array([0, 1, 2, 3, 4]));

  // Test reshape
  const reshaped = ServerTensorUtils.reshape(arange, [1, 5]);
  assertShapesEqual(reshaped.shape, [1, 5]);
  assertArraysAlmostEqual(reshaped.data, new Float32Array([0, 1, 2, 3, 4]));

  // Test add
  const a = ServerTensorUtils.arange(0, 3, 1, 'float32', 'cpu');
  const b = ServerTensorUtils.arange(1, 4, 1, 'float32', 'cpu');
  const sum = ServerTensorUtils.add(a, b);
  assertArraysAlmostEqual(sum.data, new Float32Array([1, 3, 5]));

  // Test scale
  const scaled = ServerTensorUtils.scale(a, 2);
  assertArraysAlmostEqual(scaled.data, new Float32Array([0, 2, 4]));

  console.log('✓ ServerTensorUtils tests passed');
}

// Test NodeStreamingState
function testNodeStreamingState(): void {
  console.log('Testing NodeStreamingState...');

  const state = new NodeStreamingState(3, 'cpu');
  
  // Test initial state
  if (state.batchSize !== 3) {
    throw new Error(`Expected batchSize 3, got ${state.batchSize}`);
  }
  
  assertShapesEqual(state.offsets.shape, [3]);
  assertArraysAlmostEqual(state.offsets.data, new Int32Array([0, 0, 0]));

  // Test partial reset
  state.offsets.data[0] = 5;
  state.offsets.data[1] = 10;
  state.offsets.data[2] = 15;
  
  state.reset([true, false, true]);
  assertArraysAlmostEqual(state.offsets.data, new Int32Array([0, 10, 0]));

  // Test full reset
  state.offsets.data[1] = 20;
  state.reset();
  assertArraysAlmostEqual(state.offsets.data, new Int32Array([0, 0, 0]));

  console.log('✓ NodeStreamingState tests passed');
}

// Test NodeTransformer
async function testNodeTransformer(): Promise<void> {
  console.log('Testing NodeTransformer...');

  const config: ServerTransformerConfig = {
    modelSize: 'small',
    task: 'text-generation',
    device: 'cpu',
    precision: 'float32',
    batchSize: 1
  };

  const transformer = await createServerTransformer(config);

  // Test basic forward pass
  const input = ServerTensorUtils.zeros([1, 10, 128], 'float32', 'cpu');
  const output = transformer.forward(input);

  // Output should have same shape as input for this mock model
  assertShapesEqual(output.shape, input.shape);
  
  if (output.data.length !== input.data.length) {
    throw new Error(`Output data length mismatch: ${output.data.length} vs ${input.data.length}`);
  }

  // Test streaming state creation
  const streamingState = transformer.createStreamingState(2);
  if (streamingState.batchSize !== 2) {
    throw new Error(`Expected streaming state batch size 2, got ${streamingState.batchSize}`);
  }

  // Test different model sizes
  const largeConfig: ServerTransformerConfig = {
    modelSize: 'large',
    task: 'audio-processing',
    device: 'cpu',
    precision: 'float32'
  };

  const largeTransformer = await createServerTransformer(largeConfig);
  const largeInput = ServerTensorUtils.zeros([1, 5, 512], 'float32', 'cpu');
  const largeOutput = largeTransformer.forward(largeInput);
  
  assertShapesEqual(largeOutput.shape, largeInput.shape);

  // Clean up
  transformer.dispose();
  largeTransformer.dispose();

  console.log('✓ NodeTransformer tests passed');
}

// Test different data types
function testDataTypes(): void {
  console.log('Testing different data types...');

  // Test int32 tensors
  const intTensor = ServerTensorUtils.zeros([3], 'int32', 'cpu');
  if (!(intTensor.data instanceof Int32Array)) {
    throw new Error('Expected Int32Array for int32 dtype');
  }

  // Test float64 tensors
  const doubleTensor = ServerTensorUtils.zeros([3], 'float64', 'cpu');
  if (!(doubleTensor.data instanceof Float64Array)) {
    throw new Error('Expected Float64Array for float64 dtype');
  }

  // Test arange with different dtypes
  const intRange = ServerTensorUtils.arange(0, 5, 1, 'int32', 'cpu');
  if (!(intRange.data instanceof Int32Array)) {
    throw new Error('Expected Int32Array for int32 arange');
  }
  assertArraysAlmostEqual(intRange.data, new Int32Array([0, 1, 2, 3, 4]));

  const doubleRange = ServerTensorUtils.arange(0, 3, 1, 'float64', 'cpu');
  if (!(doubleRange.data instanceof Float64Array)) {
    throw new Error('Expected Float64Array for float64 arange');
  }
  assertArraysAlmostEqual(doubleRange.data, new Float64Array([0, 1, 2]));

  console.log('✓ Data type tests passed');
}

// Test error conditions
function testErrorConditions(): void {
  console.log('Testing error conditions...');

  // Test reshape with incorrect size
  const tensor = ServerTensorUtils.zeros([2, 3], 'float32', 'cpu');
  
  try {
    ServerTensorUtils.reshape(tensor, [2, 4]);
    throw new Error('Expected reshape to throw error');
  } catch (error) {
    if (!(error as Error).message.includes('Cannot reshape')) {
      throw new Error('Expected reshape error message');
    }
  }

  // Test add with mismatched sizes
  const a = ServerTensorUtils.zeros([3], 'float32', 'cpu');
  const b = ServerTensorUtils.zeros([4], 'float32', 'cpu');
  
  try {
    ServerTensorUtils.add(a, b);
    throw new Error('Expected add to throw error');
  } catch (error) {
    if (!(error as Error).message.includes('same size')) {
      throw new Error('Expected add error message');
    }
  }

  console.log('✓ Error condition tests passed');
}

// Test TensorFlow.js integration
async function testSimpleTransformerIntegration(): Promise<void> {
  console.log('Testing simple transformer integration...');

  // Test different configurations
  const configs: ServerTransformerConfig[] = [
    { modelSize: 'small', task: 'text-generation', device: 'cpu', precision: 'float32' },
    { modelSize: 'base', task: 'audio-processing', device: 'cpu', precision: 'float32' },
    { modelSize: 'large', task: 'multimodal', device: 'cpu', precision: 'float32' }
  ];

  for (const config of configs) {
    const transformer = await createServerTransformer(config);
    
    const inputDim = config.modelSize === 'small' ? 128 : config.modelSize === 'base' ? 256 : 512;
    const input = ServerTensorUtils.zeros([1, 5, inputDim], 'float32', 'cpu');
    const output = transformer.forward(input);
    
    assertShapesEqual(output.shape, input.shape);

    transformer.dispose();
  }

  console.log('✓ Simple transformer integration tests passed');
}

// Run all tests
export async function runServerTransformerTests(): Promise<void> {
  console.log('Running Server-side Transformer Tests...\n');

  try {
    testServerTensorUtils();
    testNodeStreamingState();
    testDataTypes();
    testErrorConditions();
    await testNodeTransformer();
    await testSimpleTransformerIntegration();

    console.log('\n🎉 All server transformer tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runServerTransformerTests().catch(console.error);
}