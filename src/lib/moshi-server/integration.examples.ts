/**
 * Integration example showing how the TypeScript server works with the React client
 * This demonstrates the alignment between client and server architectures
 */

import { WebSocket } from 'ws';
import { MessageType, encodeMessage, decodeMessage } from './protocol/index.js';

async function clientIntegrationExample(): Promise<void> {
  console.log('🔗 Testing client-server integration...\n');

  const ws = new WebSocket('ws://localhost:8088');

  ws.on('open', () => {
    console.log('✅ Connected to Moshi TypeScript Server');
    
    // Send a text message
    const textMessage = 'Hello from TypeScript client!';
    const encodedText = encodeMessage(MessageType.TEXT, textMessage);
    ws.send(encodedText);
    console.log(`📤 Sent text message: "${textMessage}"`);
    
    // Send mock audio data
    const audioData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    const encodedAudio = encodeMessage(MessageType.AUDIO, audioData);
    ws.send(encodedAudio);
    console.log(`📤 Sent audio data (${audioData.length} bytes)`);
  });

  ws.on('message', (data) => {
    const messageData = new Uint8Array(data as ArrayBuffer);
    const { type, data: payload } = decodeMessage(messageData);
    
    switch (type) {
      case MessageType.TEXT:
        const textResponse = new TextDecoder().decode(payload);
        console.log(`📥 Received text: "${textResponse}"`);
        break;
        
      case MessageType.AUDIO:
        console.log(`📥 Received audio (${payload.length} bytes)`);
        break;
        
      case MessageType.METADATA:
        const serverInfo = JSON.parse(new TextDecoder().decode(payload));
        console.log(`📥 Received server info:`, {
          instance: serverInfo.instance_name,
          model: serverInfo.lm_model_file,
          runtime: serverInfo.build_info.runtime_version
        });
        break;
        
      default:
        console.log(`📥 Received unknown message type: ${type}`);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Disconnected from server');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  // Keep the connection alive for a few seconds to see responses
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  ws.close();
  console.log('\n✅ Integration test completed');
}

// Demonstrate transformer usage outside of WebSocket context
async function transformerUsageExample(): Promise<void> {
  console.log('🧠 Testing transformer usage...\n');
  
  const { createServerTransformer, ServerTensorUtils } = await import('./transformers/index.js');
  
  // Test different transformer configurations
  const configs = [
    { modelSize: 'small' as const, task: 'text-generation' as const },
    { modelSize: 'base' as const, task: 'audio-processing' as const },
    { modelSize: 'large' as const, task: 'multimodal' as const }
  ];
  
  for (const { modelSize, task } of configs) {
    console.log(`🔧 Testing ${modelSize} model for ${task}...`);
    
    const transformer = await createServerTransformer({
      modelSize,
      task,
      device: 'cpu',
      precision: 'float32'
    });
    
    // Create appropriate input tensor
    const inputDim = modelSize === 'small' ? 128 : modelSize === 'base' ? 256 : 512;
    const input = ServerTensorUtils.zeros([1, 10, inputDim], 'float32', 'cpu');
    
    // Process through transformer
    const output = transformer.forward(input);
    console.log(`   ✓ Input shape: [${input.shape}], Output shape: [${output.shape}]`);
    
    // Test streaming state
    const streamingState = transformer.createStreamingState(2);
    console.log(`   ✓ Created streaming state for batch size: ${streamingState.batchSize}`);
    
    transformer.dispose();
  }
  
  console.log('\n✅ Transformer usage test completed');
}

// Main example function
async function runIntegrationExamples(): Promise<void> {
  console.log('🎵 Moshi TypeScript Server Integration Examples\n');
  
  try {
    await transformerUsageExample();
    console.log('');
    await clientIntegrationExample();
    
    console.log('\n🎉 All integration examples completed successfully!');
  } catch (error) {
    console.error('❌ Integration example failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationExamples().catch(console.error);
}