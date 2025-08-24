
// Minimal WebSocket server (ESM) for Moshi packetized prototyping
// Run: node src/server/ws/wsServer.js
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const USE_OLLAMA = process.env.USE_OLLAMA !== '0';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3-csm:latest';

function runOllama(prompt, onChunk, onClose) {
  try {
    const proc = spawn('ollama', ['run', OLLAMA_MODEL, prompt]);
    proc.stdout.on('data', (data) => {
      onChunk(data.toString());
    });
    proc.stderr.on('data', (d) => {
      console.error('ollama stderr', d.toString());
    });
    proc.on('close', (code) => onClose(code));
    return proc;
  } catch (err) {
    console.error('Failed to spawn ollama', err);
    onChunk(`(ollama spawn error: ${err.message})`);
    onClose(-1);
    return null;
  }
}

const PORT = process.env.MOSHI_WS_PORT || 8788;

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => console.log(`Moshi WS server listening on ws://localhost:${PORT}`));

// Per-connection state
function createState() {
  return {
    sessionId: null,
    expectBinaryForSeq: null,
    lastHeader: null,
  };
}

wss.on('connection', (ws) => {
  console.log('client connected');
  ws._moshi = createState();

  ws.on('message', (data, isBinary) => {
    try {
      if (isBinary) {
        // Binary frame: either PCM or code ids depending on prior header
        const state = ws._moshi;
        if (!state.lastHeader) {
          console.warn('Binary frame received without header');
          return;
        }

        const header = state.lastHeader;
        if (header.type === 'pcm_header') {
          // Assume Float32 LE PCM float32 array
          const floatCount = data.byteLength / 4;
          console.log(`Received PCM binary seq=${header.seq} samples=${floatCount}`);
          if (USE_OLLAMA) {
            const prompt = `Received pcm frame seq=${header.seq} samples=${floatCount}. Please respond with a short acknowledgement.`;
            let chunkIdx = 0;
            const proc = runOllama(prompt, (chunk) => {
              ws.send(JSON.stringify({
                type: 'generation',
                sessionId: header.sessionId || null,
                seq: header.seq,
                chunkIndex: chunkIdx++,
                partial: true,
                text: chunk,
              }));
            }, (code) => {
              ws.send(JSON.stringify({ type: 'generation_done', sessionId: header.sessionId || null, seq: header.seq, code }));
            });
            if (!proc) {
              // fallback mock
              ws.send(JSON.stringify({ type: 'generation', sessionId: header.sessionId || null, seq: header.seq, chunkIndex: 0, partial: true, text: `(mock) processed pcm seq=${header.seq}` }));
            }
          } else {
            // Mock processing
            setTimeout(() => {
              const gen = {
                type: 'generation',
                sessionId: header.sessionId || null,
                seq: header.seq,
                chunkIndex: 0,
                partial: true,
                text: `(mock) processed pcm seq=${header.seq}`,
              };
              ws.send(JSON.stringify(gen));
            }, 40);
          }
        } else if (header.type === 'codes_header') {
          // Received Mimi discrete codes (Uint16)
          console.log(`Received Mimi codes seq=${header.seq} bytes=${data.byteLength}`);
          if (USE_OLLAMA) {
            const prompt = `Received mimi codes seq=${header.seq} length=${header.length || data.byteLength}. Provide a short response.`;
            let chunkIdx = 0;
            const proc = runOllama(prompt, (chunk) => {
              ws.send(JSON.stringify({ type: 'generation', sessionId: header.sessionId || null, seq: header.seq, chunkIndex: chunkIdx++, partial: true, text: chunk }));
            }, (code) => {
              ws.send(JSON.stringify({ type: 'generation_done', sessionId: header.sessionId || null, seq: header.seq, code }));
            });
            if (!proc) {
              ws.send(JSON.stringify({ type: 'generation', sessionId: header.sessionId || null, seq: header.seq, chunkIndex: 0, partial: true, text: `(mock) processed mimi codes seq=${header.seq}` }));
            }
          } else {
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'generation', sessionId: header.sessionId || null, seq: header.seq, chunkIndex: 0, partial: true, text: `(mock) processed mimi codes seq=${header.seq}` }));
            }, 30);
          }
        }

        // clear lastHeader after consuming binary
        state.lastHeader = null;
        return;
      }

      // String (JSON) message
      const msg = JSON.parse(typeof data === 'string' ? data : data.toString());
      // Basic handlers
      switch (msg.type) {
        case 'init':
          ws._moshi.sessionId = msg.sessionId || `s_${Math.random().toString(36).slice(2, 8)}`;
          ws.send(JSON.stringify({ type: 'init_ack', sessionId: ws._moshi.sessionId }));
          console.log('init', ws._moshi.sessionId);
          break;
        case 'pcm_header':
        case 'codes_header':
          // store header and expect a binary frame next
          ws._moshi.lastHeader = msg;
          // echo ack for header
          ws.send(JSON.stringify({ type: 'header_ack', seq: msg.seq, sessionId: msg.sessionId || ws._moshi.sessionId }));
          break;
        case 'flush':
          console.log('flush', msg.sessionId);
          ws.send(JSON.stringify({ type: 'flushed', sessionId: msg.sessionId }));
          break;
        case 'close':
          ws.send(JSON.stringify({ type: 'closed', sessionId: msg.sessionId }));
          ws.close();
          break;
        default:
          console.log('unknown msg', msg.type);
          break;
      }
    } catch (err) {
      console.error('message handling error', err);
    }
  });

  ws.on('close', () => {
    console.log('client disconnected');
  });
});

wss.on('error', (err) => console.error('ws error', err));

