# Moshi Packetized WebSocket Protocol (prototype)

This document describes a minimal packetized WebSocket protocol used by the PoC server and client.

Message types (JSON control messages)
- init: {type:'init', sessionId?:string}
- init_ack: {type:'init_ack', sessionId}
- pcm_header: {type:'pcm_header', seq, sessionId?, samples, sampleRate, frameRate}
- codes_header: {type:'codes_header', seq, sessionId?, length}
- header_ack: {type:'header_ack', seq, sessionId}
- generation: {type:'generation', sessionId, seq, chunkIndex, partial, text}
- flush/closed etc.

Binary frames
- The client can follow a header with a single binary frame containing the payload.
- For `pcm_header` the binary payload is Float32Array (little-endian) of PCM samples.
- For `codes_header` the binary payload is Uint16Array of Mimi code ids.

Session semantics
- The client sends `init`; server responds with `init_ack` and sessionId.
- For each frame, client sends `pcm_header` or `codes_header` and then the binary frame.
- Server responds with a `header_ack` and later `generation` chunks as needed.

Backpressure
- Server can send `throttle` messages (not implemented in PoC) with suggested window sizes.

Notes
- The PoC server (`src/server/ws/wsServer.js`) is a mock. Replace processing sections with calls to Mimi/MLX pipeline or llama.cpp proxy for real inference.
