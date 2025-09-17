// Simple test client: sends one 1920-sample Float32 PCM frame to WS server
import WebSocket from 'ws';

const URL = process.env.MOSHI_WS_URL || 'ws://localhost:8788';

const ws = new WebSocket(URL);

ws.on('open', () => {
  console.log('connected to', URL);
  const seq = 1;
  const header = { type: 'pcm_header', seq, sessionId: 'test-session', samples: 1920, sampleRate: 24000, frameRate: 12.5 };
  ws.send(JSON.stringify(header));
  // create 1920 zeros Float32
  const floatArr = new Float32Array(1920);
  const buf = Buffer.from(floatArr.buffer);
  ws.send(buf);
  console.log('sent pcm frame');
});

ws.on('message', (data, isBinary) => {
  if (isBinary) {
    console.log('binary reply length', data.length);
    return;
  }
  try {
    const msg = JSON.parse(data.toString());
    console.log('->', msg.type, msg.text ? msg.text.substring(0,120) : '');
  } catch (e) {
    console.log('text reply:', data.toString());
  }
});

ws.on('close', () => console.log('ws closed'));
ws.on('error', (e) => console.error('ws error', e));
