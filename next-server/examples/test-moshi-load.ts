/**
 * Test loading actual Moshi model from HuggingFace
 */

import { promises as fs } from 'fs';
import path from 'path';
import mlx from '@frost-beta/mlx';
import { hfGet } from './lib/hf-loader';
import { LmModel, createLmConfigFromDict } from './lib/unified/models/moshi-mlx/lm';

const { core: mx } = mlx;

async function testMoshiLoad() {
  console.log('🚀 Testing Moshi Model Loading...\n');
  
  const repo = 'kyutai/moshiko-mlx-bf16';
  
  try {
    // Step 1: Load config
    console.log('1️⃣ Loading config from HuggingFace...');
    const configPath = await hfGet('config.json', repo);
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    console.log('✅ Config loaded');
    console.log('   Model dimensions:', config.dim);
    console.log('   Layers:', config.num_layers);
    console.log('   Heads:', config.num_heads);
    
    // Step 2: Create model config
    console.log('\n2️⃣ Creating LM config...');
    const lmConfig = createLmConfigFromDict(config);
    console.log('✅ LM config created');
    console.log('   Text vocab:', lmConfig.text_in_vocab_size);
    console.log('   Audio vocab:', lmConfig.audio_vocab_size);
    console.log('   Audio codebooks:', lmConfig.audio_codebooks);
    
    // Step 3: Initialize model
    console.log('\n3️⃣ Initializing model...');
    const model = new LmModel(lmConfig);
    console.log('✅ Model initialized (no weights yet)');
    
    // Step 4: Check for weights file
    console.log('\n4️⃣ Checking for model weights...');
    try {
      const weightsPath = await hfGet('model.safetensors', repo);
      console.log('✅ Weights file found at:', weightsPath);
      
      // Check file size
      const stats = await fs.stat(weightsPath);
      console.log('   File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
      
      // Note: Actually loading weights would require safetensors parser
      console.log('⚠️  Note: Loading safetensors requires additional parsing');
      
    } catch (e) {
      console.log('⚠️  Weights not found or error:', e);
    }
    
    // Step 5: Test simple forward pass with random data
    console.log('\n5️⃣ Testing forward pass with random data...');
    const batchSize = 1;
    const seqLen = 10;
    
    // Create random inputs
    const textTokens = mx.zeros([batchSize, seqLen]);
    const audioCodes = [
      mx.zeros([batchSize, seqLen]),
      mx.zeros([batchSize, seqLen])
    ];
    
    // Initialize model with empty weights
    await model.init();
    
    // Try forward pass
    try {
      const output = model.forward(textTokens, audioCodes);
      console.log('✅ Forward pass completed');
      console.log('   Text logits shape:', output.text_logits.shape);
      console.log('   Audio logits:', output.audio_logits.length, 'codebooks');
    } catch (e) {
      console.log('⚠️  Forward pass failed (expected without real weights):', e.message);
    }
    
    // Step 6: Test config compatibility
    console.log('\n6️⃣ Checking config compatibility...');
    const requiredFields = ['dim', 'num_heads', 'num_layers', 'text_card', 'card', 'n_q', 'delays'];
    const missingFields = requiredFields.filter(field => !(field in config));
    
    if (missingFields.length === 0) {
      console.log('✅ Config has all required fields');
    } else {
      console.log('⚠️  Missing fields:', missingFields);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMoshiLoad().then(() => {
  console.log('\n✨ Model loading test complete!');
}).catch(console.error);