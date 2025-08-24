# Moshi TypeScript Server

A server-side Node.js/TypeScript implementation of the Moshi transformer that aligns with the React/TypeScript client architecture, making TypeScript a first-class citizen for both client and server-side code.

## Overview

This server provides a TypeScript alternative to the Python server implementation, featuring:

- **TypeScript-first**: Server-side code written in TypeScript for consistency with the React client
- **TensorFlow.js Integration**: Uses TensorFlow.js Node.js for ML operations instead of WebGPU (client-side)
- **WebSocket Protocol**: Compatible with the existing client WebSocket protocol
- **Streaming Support**: Handles real-time audio and text processing
- **Production Ready**: Includes proper error handling, logging, and graceful shutdown

## Architecture

The server is structured to mirror the client-side architecture:

```
server/
├── src/
│   ├── transformers/         # Server-side transformer implementation
│   │   └── index.ts         # NodeTransformer, ServerTensorUtils
│   ├── protocol/            # WebSocket protocol implementation
│   │   └── index.ts         # Message encoding/decoding
│   ├── server.ts            # Main WebSocket server
│   ├── index.ts             # Application entry point
│   └── transformer.test.ts  # Comprehensive tests
├── package.json             # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## Features

### Core Classes

- **NodeTransformer**: Server-side transformer using TensorFlow.js Node.js
- **NodeStreamingState**: Manages streaming state for real-time processing
- **ServerTensorUtils**: Tensor operations using standard TypedArrays
- **MoshiServer**: WebSocket server with Express.js integration

### Capabilities

- **Multi-modal Processing**: Supports text, audio, and multimodal tasks
- **Device Selection**: CPU processing (GPU through TensorFlow.js if available)
- **Precision Control**: float32, float16 support
- **Real-time Streaming**: WebSocket-based real-time communication
- **Health Monitoring**: Built-in health checks and metrics

## Installation

```bash
cd server
npm install
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Testing

```bash
npm test
```

## Configuration

Environment variables:

- `PORT`: Server port (default: 8088)
- `NODE_ENV`: Environment (development/production)

## WebSocket Protocol

The server implements the same WebSocket protocol as the Python server:

### Message Types

- `0x01`: Audio data (binary)
- `0x02`: Text data (UTF-8)
- `0x03`: Metadata/server info (JSON)

### Message Format

```
[message_type:1][payload:n]
```

### Server Info

The server provides metadata about its configuration:

```json
{
  "text_temperature": 0.7,
  "text_topk": 50,
  "audio_temperature": 0.8,
  "audio_topk": 40,
  "pad_mult": 8,
  "repetition_penalty_context": 64,
  "repetition_penalty": 1.1,
  "lm_model_file": "moshi-server-typescript",
  "instance_name": "Moshi TypeScript Server",
  "build_info": {
    "runtime_version": "v18.17.0",
    "platform": "linux"
  }
}
```

## API Endpoints

### HTTP Endpoints

- `GET /health` - Health check and server status
- `GET /api/info` - Server configuration and metadata
- `WS /` - WebSocket connection for real-time communication

## Integration with Client

The server is designed to work seamlessly with the existing React client:

1. **Compatible Protocol**: Uses the same WebSocket message format
2. **TypeScript Types**: Shared type definitions for consistency
3. **Real-time Processing**: Supports the same streaming workflows

### Client Connection Example

```typescript
// Client-side connection
const ws = new WebSocket('ws://localhost:8088');

ws.onopen = () => {
  // Server automatically sends metadata upon connection
};

ws.onmessage = (event) => {
  const data = new Uint8Array(event.data);
  const { type, data: payload } = decodeMessage(data);
  
  switch (type) {
    case MessageType.TEXT:
      console.log('Text:', new TextDecoder().decode(payload));
      break;
    case MessageType.AUDIO:
      // Handle audio response
      break;
    case MessageType.METADATA:
      const serverInfo = JSON.parse(new TextDecoder().decode(payload));
      console.log('Server info:', serverInfo);
      break;
  }
};
```

## Comparison with Python Server

| Feature | Python Server | TypeScript Server |
|---------|---------------|------------------|
| Language | Python | TypeScript |
| ML Backend | PyTorch | TensorFlow.js |
| Protocol | WebSocket | WebSocket (compatible) |
| Real-time | ✅ | ✅ |
| GPU Support | CUDA/MPS | TensorFlow.js GPU |
| Memory Usage | Higher | Lower |
| Startup Time | Slower | Faster |

## Performance Considerations

- **Memory Efficient**: Uses TypedArrays for tensor operations
- **Non-blocking**: Async/await throughout for better concurrency
- **Connection Management**: Automatic cleanup of inactive connections
- **Resource Management**: Proper disposal of TensorFlow.js tensors

## Development

### Adding New Features

1. **Extend ServerTransformerConfig** for new configuration options
2. **Modify NodeTransformer** for new model capabilities
3. **Update Protocol** if new message types are needed
4. **Add Tests** for any new functionality

### Testing

The test suite covers:

- Tensor operations and utilities
- Transformer initialization and forward passes
- Streaming state management
- Protocol message encoding/decoding
- Error conditions and edge cases

```bash
npm test  # Run all tests
npm run lint  # Code linting
```

## License

This server implementation follows the same license as the main Moshi project.

## Contributing

1. Follow TypeScript and Node.js best practices
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure compatibility with the React client