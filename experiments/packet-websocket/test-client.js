// Minimal packet-client to verify Packet WebSocket Server end-to-end
// Usage: node experiments/packet-websocket/test-client.js

const WebSocket = require('ws');

const PacketType = {
  AUDIO_CHUNK: 0x10,
  TEXT_PARTIAL: 0x20,
  TEXT_FINAL: 0x21,
  METADATA: 0x30,
  HEARTBEAT: 0x01,
  ACK: 0x02,
};

const Priority = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function encodePacket({ type, priority, sequenceNumber, timestamp, data, requiresAck }) {
  const header = Buffer.alloc(17);
  header.writeUInt8(type, 0);
  header.writeUInt8(priority, 1);
  header.writeUInt32LE(sequenceNumber, 2);
  header.writeDoubleLE(timestamp, 6);
  header.writeUInt16LE(data.length, 14);
  header.writeUInt8(requiresAck ? 1 : 0, 16);
  return Buffer.concat([header, Buffer.from(data)]);
}

function decodePacket(buf) {
  const type = buf.readUInt8(0);
  const priority = buf.readUInt8(1);
  const sequenceNumber = buf.readUInt32LE(2);
  const timestamp = buf.readDoubleLE(6);
  const length = buf.readUInt16LE(14);
  const requiresAck = buf.readUInt8(16) === 1;
  const data = buf.slice(17, 17 + length);
  return { type, priority, sequenceNumber, timestamp, data, requiresAck };
}

function now() { return Date.now(); }

async function main() {
  const url = process.env.PACKET_URL || 'ws://localhost:8788';
  let seq = 1;

  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  ws.on('open', () => {
    console.log('[client] connected to', url);

    // Send metadata: conversation_start
    const meta = {
      type: 'conversation_start',
      config: { sampleRate: 24000, format: 'pcm' }
    };
    const metaPacket = encodePacket({
      type: PacketType.METADATA,
      priority: Priority.LOW,
      sequenceNumber: seq++,
      timestamp: now(),
      data: Buffer.from(JSON.stringify(meta), 'utf8'),
      requiresAck: false,
    });
    ws.send(metaPacket);

    // Send final text
    const text = 'Hello from test client';
    const textPacket = encodePacket({
      type: PacketType.TEXT_FINAL,
      priority: Priority.HIGH,
      sequenceNumber: seq++,
      timestamp: now(),
      data: Buffer.from(text, 'utf8'),
      requiresAck: true,
    });
    ws.send(textPacket);

    // Send a small audio chunk (sine wave 440Hz)
    const sr = 24000;
    const len = 1024;
    const f32 = new Float32Array(len);
    for (let i = 0; i < len; i++) f32[i] = 0.1 * Math.sin(2 * Math.PI * 440 * i / sr);
    const audioPacket = encodePacket({
      type: PacketType.AUDIO_CHUNK,
      priority: Priority.CRITICAL,
      sequenceNumber: seq++,
      timestamp: now(),
      data: Buffer.from(f32.buffer),
      requiresAck: false,
    });
    ws.send(audioPacket);
  });

  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const pkt = decodePacket(buf);
    if (pkt.type === PacketType.METADATA) {
      console.log('[client] metadata:', pkt.data.toString('utf8'));
    } else if (pkt.type === PacketType.TEXT_PARTIAL) {
      console.log('[client] text partial:', pkt.data.toString('utf8'));
    } else if (pkt.type === PacketType.TEXT_FINAL) {
      console.log('[client] text final:', pkt.data.toString('utf8'));
    } else if (pkt.type === PacketType.AUDIO_CHUNK) {
      console.log('[client] audio chunk:', pkt.data.length, 'bytes');
    } else if (pkt.type === PacketType.ACK) {
      const acked = new DataView(pkt.data.buffer, pkt.data.byteOffset, pkt.data.byteLength).getUint32(0, true);
      console.log('[client] ack for seq', acked);
    } else {
      console.log('[client] packet type', pkt.type, 'len', pkt.data.length);
    }
  });

  ws.on('close', () => console.log('[client] closed'));
  ws.on('error', (err) => console.error('[client] error', err));

  // Close after a few seconds
  setTimeout(() => ws.close(), 4000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

