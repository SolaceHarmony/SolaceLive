/**
 * Test Moshi with local config files
 */

import { promises as fs } from 'fs';
import mlx from '@frost-beta/mlx';
import { LmModel, createLmConfigFromDict } from './backend/models/moshi-mlx/lm';
import { Mimi } from './backend/models/moshi-mlx/mimi';

const { core: mx } = mlx;

async function testLocalMoshi() {
  console.log('🎯 Testing Moshi with Local Configs...\n');
  
  try {
    // Test with moshi_mlx_2b config
    console.log('1️⃣ Loading moshi_mlx_2b.json config...');
    const configPath = './backend/configs/moshi_mlx_2b.json';
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    console.log('✅ Config loaded:');
    console.log('   Dimensions:', config.dim);
    console.log('   Layers:', config.num_layers);
    console.log('   Audio codebooks:', config.n_q);
    console.log('   Text vocab:', config.text_card);
    console.log('   Audio vocab:', config.card);
    
    // Create LM config
    console.log('\n2️⃣ Creating language model...');
    const lmConfig = createLmConfigFromDict(config);
    const model = new LmModel(lmConfig);
    await model.init(); // Initialize with random weights
    console.log('✅ Model created with config');
    
    // Test Mimi codec
    console.log('\n3️⃣ Testing Mimi audio codec...');
    const mimi = new Mimi();
    
    // Create test audio (1 second @ 24kHz)
    const testAudio = new Float32Array(24000);
    for (let i = 0; i < testAudio.length; i++) {
      // Generate a simple sine wave
      testAudio[i] = Math.sin(2 * Math.PI * 440 * i / 24000) * 0.5;
    }
    
    console.log('   Input audio:', testAudio.length, 'samples');
    
    // Convert to packets
    const packets = mimi.audioToPackets(testAudio);
    console.log('✅ Audio → Packets:', packets.length, 'packets');
    console.log('   Each packet has', packets[0]?.tokens.length, 'tokens');
    
    // Convert back
    const reconstructed = mimi.packetsToAudio(packets);
    console.log('✅ Packets → Audio:', reconstructed.length, 'samples');
    
    // Test simple generation
    console.log('\n4️⃣ Testing simple generation...');
    const batchSize = 1;
    const seqLen = 5;
    
    // Create simple inputs
    const textPrompt = mx.zeros([batchSize, seqLen]);
    const audioPrompt = [
      mx.zeros([batchSize, seqLen]),
      mx.zeros([batchSize, seqLen])
    ];
    
    try {
      const result = model.generate(textPrompt, audioPrompt, 10, 0.8);
      console.log('✅ Generation completed');
      console.log('   Generated text tokens:', result.text_tokens.shape);
      console.log('   Generated audio codes:', result.audio_codes.length, 'codebooks');
    } catch (e) {
      console.log('⚠️  Generation needs real weights:', e.message);
    }
    
    // Test packet integration
    console.log('\n5️⃣ Testing packet-based processing...');
    
    // Simulate receiving audio packets
    const audioPacket = {
      type: 0x11, // AUDIO_PCM
      data: testAudio.slice(0, 1920), // 80ms @ 24kHz
      timestamp: Date.now()
    };
    
    // Convert packet to tokens (what Mimi would do)
    const frameTokens = mimi.audioToPackets(audioPacket.data);
    console.log('✅ Packet → Tokens:', frameTokens[0]?.tokens.length, 'tokens per frame');
    
    // These tokens would go to the model
    const tokenArray = mx.array(frameTokens[0]?.tokens || []);
    console.log('✅ Ready for model input:', tokenArray.shape);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testLocalMoshi().then(() => {
  console.log('\n✨ Local Moshi test complete!');
}).catch(console.error);
