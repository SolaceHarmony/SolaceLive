# Web-based Transformer Implementation

This directory contains a modern, web-standard transformer implementation that replaces the custom transformer module. The implementation uses standard Web APIs and is designed to be compatible with WASM-based ML inference libraries.

## Features

The Web-based implementation includes:

### Core Classes

1. **WebTransformer** - Main transformer class using Web APIs with WebGPU support
2. **WebStreamingState** - Manages streaming state for autoregressive generation
3. **TensorUtils** - Utility functions for tensor operations using TypedArrays

### Web Standards Support

- **WebGPU** - GPU acceleration when available (automatically falls back to CPU)
- **TypedArrays** - Efficient numerical operations using native browser APIs
- **Standard interfaces** - Compatible with common ML library patterns
- **Lightweight** - No heavy dependencies, works entirely in the browser

### Tensor Operations

- **TensorUtils** - Basic tensor operations using standard Web APIs
  - `zeros()` - Create zero-filled tensors
  - `arange()` - Create sequence tensors
  - `reshape()` - Reshape tensors with validation
  - `add()` - Element-wise tensor addition
  - `scale()` - Scalar multiplication

### Configuration

- **TransformerConfig** - Flexible configuration for different use cases
  - Model sizes: small, base, large
  - Tasks: text-generation, audio-processing, multimodal
  - Device selection: CPU or GPU (WebGPU)
  - Precision: float32, float16

## Files

- `transformers/index.ts` - Main transformer implementation
- `web-transformer.test.ts` - Unit tests for the web-based transformer
- `web-transformer-examples.ts` - Usage examples and demonstrations

## Usage Examples

### Basic Transformer

```typescript
import { createTransformer, TensorUtils } from './transformers';

const config = {
  modelSize: 'base',
  task: 'text-generation',
  device: 'cpu',
  precision: 'float32'
};

const transformer = await createTransformer(config);

// Create input tensor [batch_size, seq_len, dim]
const input = TensorUtils.zeros([1, 10, 256]);
const output = transformer.forward(input);
```

### Audio Processing

```typescript
const audioConfig = {
  modelSize: 'small',
  task: 'audio-processing',
  device: 'gpu', // Will fallback to CPU if WebGPU unavailable
};

const audioTransformer = await createTransformer(audioConfig);

// Process audio data
const audioInput = {
  data: new Float32Array(1000), // Your audio samples
  shape: [1, 1000, 1],
  device: 'cpu',
  dtype: 'float32'
};

const processedAudio = audioTransformer.forward(audioInput);
```

### Streaming State Management

```typescript
const transformer = await createTransformer(config);
const streamingState = transformer.createStreamingState(3);

// Use streaming state for autoregressive generation
console.log('Initial offsets:', streamingState.offsets.data);

// Reset specific states
streamingState.reset([true, false, true]);
```

## Configuration Options

### TransformerConfig

- `modelSize` - Model complexity ('small' | 'base' | 'large')
- `task` - Processing task type ('text-generation' | 'audio-processing' | 'multimodal')
- `device` - Computation device ('cpu' | 'gpu')
- `precision` - Numerical precision ('float32' | 'float16')

### WebTransformer Methods

- `initialize()` - Initialize the transformer (automatic with createTransformer)
- `forward(input: Tensor)` - Run forward inference
- `createStreamingState(batchSize: number)` - Create streaming state manager

## Implementation Notes

### Advantages over Custom Implementation

1. **Web Standards**: Uses established Web APIs instead of custom implementations
2. **Performance**: Leverages WebGPU for hardware acceleration when available
3. **Compatibility**: Standard tensor interface compatible with other ML libraries
4. **Maintainability**: Simpler, more focused implementation
5. **Future-proof**: Built on web standards that will continue to evolve

### WebGPU Support

The implementation automatically detects and uses WebGPU when available:
- Automatic fallback to CPU if WebGPU is not supported
- Error handling for WebGPU initialization failures
- Transparent to the user - same API regardless of backend

### Limitations Addressed

- **No custom tensor library**: Uses standard TypedArrays
- **Simplified operations**: Focus on essential operations needed for inference
- **Web-optimized**: Designed specifically for browser environments
- **Extensible**: Easy to extend with additional operations as needed

## Migration from Custom Transformer

The new implementation provides a similar API to the custom transformer:

```typescript
// Old custom implementation
import { StreamingTransformer, ProjectedTransformer } from './transformer';

// New web-based implementation
import { createTransformer, WebTransformer } from './transformers';

// Migration is straightforward with similar patterns
const transformer = await createTransformer({
  modelSize: 'base',
  task: 'text-generation'
});
```

## Testing

Run the test suite:

```bash
npx tsx src/web-transformer.test.ts
```

Run examples:

```bash
npx tsx src/web-transformer-examples.ts
```

Build and type-check:

```bash
npm run build
npx tsc --noEmit
```

## Architecture Compatibility

This Web-based implementation maintains conceptual compatibility with the original transformer while being:

- **Lighter weight** - No complex custom implementations
- **More standard** - Uses established Web APIs
- **Better performing** - WebGPU acceleration when available
- **Easier to maintain** - Cleaner, more focused codebase
- **Future-ready** - Built on evolving web standards

The implementation serves as a foundation that can be easily extended with more sophisticated ML libraries like @huggingface/transformers or custom WASM modules as needed.