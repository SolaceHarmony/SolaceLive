# Library Consolidation Plan

## Best Implementations to Keep

### Core Components
1. **WebSocket/Packet Protocol**: `/src/lib/moshi-protocol/packets.ts` - Most comprehensive packet system with CSM support
2. **Packet WebSocket Client**: `/src/lib/packet-websocket.ts` - Clean implementation with priority queues

### Moshi Model
1. **MLX TypeScript**: `/next-server/lib/mlx/transformer.ts` and `lm.ts` - New TypeScript MLX implementation
2. **Model Bridge**: `/src/lib/moshi-neuromorphic/MoshiModelBridge.ts` - Good abstraction layer
3. **Python MLX**: `/moshi-typescript/moshi_mlx/` - Keep as reference for TypeScript port

### Audio Processing
1. **WhisperX**: `/src/lib/whisperx/` - Complete implementation
2. **Audio Services**: `/src/services/` - Working services

### Services
1. **Streaming Service**: `/src/services/csmStreamingService.ts`
2. **Speech Service**: `/src/services/speechService.ts`
3. **VAD**: `/src/services/voiceActivityDetection.ts`

## Move Commands

```bash
# Core
mv /src/lib/moshi-protocol/packets.ts -> /next-server/lib/unified/core/packets.ts
mv /src/lib/packet-websocket.ts -> /next-server/lib/unified/core/websocket.ts

# Models
mv /next-server/lib/mlx/* -> /next-server/lib/unified/models/moshi-mlx/
mv /src/lib/moshi-neuromorphic/MoshiModelBridge.ts -> /next-server/lib/unified/models/moshi-bridge.ts

# Audio
mv /src/lib/whisperx/* -> /next-server/lib/unified/audio/whisperx/

# Services  
mv /src/services/* -> /next-server/lib/unified/services/

# Types
mv /src/types/* -> /next-server/lib/unified/types/
```

## To Delete After Moving
- `/src/lib/moshi-complete/` - Full duplicate
- `/src/lib/moshi-server/` - Duplicate configs
- `/src/lib/moshi/` - Empty
- `/moshi-typescript/` - Full duplicate (keep only for reference)
- `/next-server/lib/core/` - Our earlier attempt