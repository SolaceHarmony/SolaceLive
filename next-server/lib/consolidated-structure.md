# Consolidated Library Structure

## Current Duplication Issues

### 1. Moshi Implementations (5+ copies)
- `/moshi-typescript/` - Full Moshi codebase
- `/src/lib/moshi-complete/` - Another full copy  
- `/src/lib/moshi-neuromorphic/` - Neuromorphic variant
- `/src/lib/moshi-server/` - Server implementation
- `/next-server/lib/mlx/` - TypeScript MLX implementation

### 2. WebSocket/Packet Implementations (3+ copies)
- `/src/lib/packet-websocket.ts` - Packet-based WebSocket
- `/src/lib/moshi-protocol/` - Enhanced packet protocol
- `/src/lib/moshi-ws-client.ts` - Moshi WebSocket client

### 3. Audio Processing (Multiple copies)
- WhisperX in `/src/lib/whisperx/`
- WhisperWasm service
- Audio processors in multiple locations

## Proposed Consolidated Structure

```
/next-server/lib/
├── core/
│   ├── websocket.ts          # Unified WebSocket with packet support
│   ├── packet-protocol.ts    # Single packet protocol implementation
│   └── audio-processor.ts    # Unified audio processing
│
├── models/
│   ├── moshi/
│   │   ├── mlx/              # MLX implementation (TypeScript)
│   │   │   ├── transformer.ts
│   │   │   ├── lm.ts
│   │   │   ├── mimi.ts       # Audio codec
│   │   │   └── loader.ts     # Model loader
│   │   ├── config.ts         # Unified config
│   │   └── index.ts          # Main export
│   │
│   └── whisper/
│       ├── engine.ts         # WhisperX engine
│       ├── vad.ts           # Voice activity detection
│       └── index.ts
│
├── services/
│   ├── streaming.ts         # Unified streaming service
│   ├── speech.ts           # Speech synthesis
│   └── transcription.ts    # Transcription service
│
└── utils/
    ├── hf-loader.ts        # HuggingFace loader (exists)
    └── audio-utils.ts      # Audio utilities
```

## Migration Plan

1. Consolidate packet/WebSocket implementations
2. Merge all Moshi model code into single location
3. Unify audio processing pipelines
4. Update all imports to use consolidated modules
5. Delete duplicate files