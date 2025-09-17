# Unified SolaceLive Library

This is the consolidated library containing all SolaceLive functionality, eliminating the previous duplication across 700+ folders.

## Structure

### `/core`
- **packets.ts** - Enhanced packet protocol with CSM support
- **websocket-client.ts** - Unified WebSocket client with packet support
- **encoder.ts** - Packet encoding/decoding
- **packet-processor.ts** - Packet processing logic
- **transformer.ts** - Transformer utilities
- **types.ts** - Core type definitions

### `/models`
- **moshi-mlx/** - TypeScript MLX implementation of Moshi
  - transformer.ts - Transformer architecture
  - lm.ts - Language model
- **moshi-bridge.ts** - Bridge between neuromorphic and Moshi models
- **neuromorphic/** - Neuromorphic components
  - MoshiKernel.ts
  - ConsciousnessOrchestrator.ts
  - MimiGammaSynchronizer.ts

### `/audio`
- **whisperx/** - WhisperX implementation (translated from Python)
  - Real-time transcription
  - VAD (Voice Activity Detection)
  - Speaker diarization
  - Alignment models

### `/services`
- **audioService.ts** - Audio processing service
- **csmStreamingService.ts** - CSM streaming service
- **speechService.ts** - Speech synthesis
- **voiceActivityDetection.ts** - VAD service
- **whisperWasmService.ts** - WhisperWasm integration
- **packetStreamingService.ts** - Packet-based streaming

### `/components`
- React components for the UI
- StreamingVoiceInterface
- NeuromorphicVoiceInterface
- ConsciousnessMonitor

### `/reference`
- **moshi-typescript/** - Original Moshi TypeScript reference
- **python-mlx/** - Python MLX implementation (reference for TS port)
- **python-torch/** - Python PyTorch implementation
- **whisperX/** - Original WhisperX Python code

### `/server`
- Server-side implementations
- WebSocket servers
- Legacy server code

### `/utils`
- Utility functions
- Audio utilities
- Logging

### `/types`
- TypeScript type definitions
- Shared interfaces

### `/configs`
- Model configurations
- moshi_7b_202409.json
- moshi_dev_2b.json
- moshi_mlx_2b.json

## Usage

```typescript
import {
  UnifiedWebSocket,
  PacketType,
  LmModel,
  StreamingVoiceInterface,
  WhisperXEngine
} from '@/backend';
```

## Key Features

1. **Unified WebSocket** - Single WebSocket implementation combining packet protocol with Moshi streaming
2. **TypeScript MLX** - Pure TypeScript implementation of Moshi using @frost-beta/mlx
3. **WhisperX** - Complete TypeScript port of WhisperX for real-time transcription
4. **Neuromorphic Layer** - Experimental consciousness-inspired processing
5. **React 19 Components** - Ready-to-use UI components with streaming support

## Migration Notes

All duplicate implementations have been consolidated here. Previous imports should be updated to use this unified library:

- `/src/lib/moshi-protocol/` → `/next-server/backend/core/`
- `/src/lib/packet-websocket.ts` → `/next-server/backend/core/websocket-client.ts`
- `/src/services/` → `/next-server/backend/services/`

## Next Steps

1. Update all imports in existing code to use unified library
2. Remove duplicate node_modules
3. Consolidate package.json dependencies
4. Test end-to-end with kyutai/moshiko-mlx-bf16 model
