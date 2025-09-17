/**
 * Test WebSocket packet streaming
 */

import { PacketWebSocket, PacketType, Priority } from './backend/core/websocket-client';

async function testWebSocket() {
  console.log('🌐 Testing WebSocket Packet System...\n');
  
  // Create mock WebSocket server first
  console.log('1️⃣ Creating mock WebSocket client...');
  
  // Note: This would normally connect to a real server
  // For testing, we'll just test the client-side logic
  
  const client = new PacketWebSocket('ws://localhost:8080/test');
  
  // Set up event handlers
  client.on('connected', () => {
    console.log('✅ Connected');
  });
  
  client.on('disconnected', (code, reason) => {
    console.log('📡 Disconnected:', code, reason);
  });
  
  client.on('audio', (data, format) => {
    console.log('🎵 Received audio:', format, 'format');
  });
  
  client.on('textPartial', (text) => {
    console.log('💬 Partial text:', text);
  });
  
  client.on('textFinal', (text) => {
    console.log('📝 Final text:', text);
  });
  
  client.on('moshiAudioCodes', (codes) => {
    console.log('🎹 Moshi audio codes:', codes.length);
  });
  
  client.on('moshiTextTokens', (tokens) => {
    console.log('📚 Moshi text tokens:', tokens.length);
  });
  
  // Test packet creation and queueing
  console.log('\n2️⃣ Testing packet creation...');
  
  // Create test audio
  const testAudio = new Float32Array(1920); // 80ms @ 24kHz
  for (let i = 0; i < testAudio.length; i++) {
    testAudio[i] = Math.random() * 0.1;
  }
  
  // Test sending different packet types
  console.log('   Queueing audio packet...');
  client.sendAudio(testAudio, 'pcm');
  
  console.log('   Queueing text packet...');
  client.sendText('Hello Moshi', false);
  
  console.log('   Queueing Moshi codes...');
  client.sendMoshiAudioCodes([1, 2, 3, 4, 5, 6, 7, 8]);
  
  console.log('   Queueing Moshi tokens...');
  client.sendMoshiTextTokens([100, 200, 300]);
  
  // Check queue status
  const queueSizes = client.getQueueSizes();
  console.log('✅ Queue sizes:', queueSizes);
  
  // Test stats
  console.log('\n3️⃣ Testing stats...');
  const stats = client.getStats();
  console.log('📊 Stats:', stats);
  
  // Test priority system
  console.log('\n4️⃣ Testing priority queue...');
  
  // Send packets with different priorities
  client.send(PacketType.HEARTBEAT, new Uint8Array(0), Priority.LOW);
  client.send(PacketType.AUDIO_PCM, testAudio, Priority.CRITICAL);
  client.send(PacketType.TEXT_PARTIAL, 'medium priority', Priority.NORMAL);
  
  const sizes = client.getQueueSizes();
  console.log('✅ Packets queued with priorities:', sizes);
  
  // Clean up
  client.disconnect();
  console.log('\n✅ WebSocket client tested (without actual connection)');
}

// Run the test
testWebSocket().then(() => {
  console.log('\n✨ WebSocket test complete!');
}).catch(console.error);
