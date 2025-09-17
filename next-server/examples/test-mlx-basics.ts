/**
 * Basic MLX functionality test
 * Tests that we can:
 * 1. Import @frost-beta/mlx correctly
 * 2. Create basic tensors
 * 3. Run simple operations
 * 4. Build a basic model
 */

import mlx from '@frost-beta/mlx';
const { core: mx, nn } = mlx;

console.log('🧪 Testing MLX Basics...\n');

// Test 1: Basic tensor creation
console.log('1️⃣ Testing tensor creation:');
try {
  const tensor = mx.array([1, 2, 3, 4]);
  console.log('✅ Created tensor:', tensor);
  console.log('   Shape:', tensor.shape);
  console.log('   Dtype:', tensor.dtype);
} catch (e) {
  console.error('❌ Failed to create tensor:', e);
}

// Test 2: Basic operations
console.log('\n2️⃣ Testing basic operations:');
try {
  const a = mx.array([[1, 2], [3, 4]]);
  const b = mx.array([[5, 6], [7, 8]]);
  
  const sum = mx.add(a, b);
  const product = mx.matmul(a, b);
  
  console.log('✅ Addition works');
  console.log('✅ Matrix multiplication works');
} catch (e) {
  console.error('❌ Basic operations failed:', e);
}

// Test 3: Random generation
console.log('\n3️⃣ Testing random generation:');
try {
  const random = mx.random.normal([2, 3]);
  console.log('✅ Generated random tensor with shape:', random.shape);
} catch (e) {
  console.error('❌ Random generation failed:', e);
}

// Test 4: Simple neural network
console.log('\n4️⃣ Testing simple neural network:');
try {
  // Create a simple 2-layer network
  const model = new nn.Sequential(
    new nn.Linear(2, 4),
    nn.relu,
    new nn.Linear(4, 1)
  );
  
  // Test forward pass
  const input = mx.random.normal([1, 2]);
  const output = model.forward(input);
  
  console.log('✅ Model created and forward pass works');
  console.log('   Input shape:', input.shape);
  console.log('   Output shape:', output.shape);
} catch (e) {
  console.error('❌ Neural network test failed:', e);
}

// Test 5: Our custom classes
console.log('\n5️⃣ Testing our custom MLX modules:');
try {
  // Test importing our modules
  const { Transformer } = await import('./backend/models/moshi-mlx/transformer');
  const { LmModel, createLmConfigFromDict } = await import('./backend/models/moshi-mlx/lm');
  const { Mimi } = await import('./backend/models/moshi-mlx/mimi');
  
  console.log('✅ Successfully imported Transformer');
  console.log('✅ Successfully imported LmModel');
  console.log('✅ Successfully imported Mimi');
  
  // Try creating instances
  const mimi = new Mimi();
  console.log('✅ Created Mimi instance');
  
} catch (e) {
  console.error('❌ Custom module test failed:', e);
}

console.log('\n✨ Basic tests complete!');
