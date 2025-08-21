# TypeScript Transformer Implementation

**⚠️ DEPRECATED: This implementation is deprecated in favor of the new Web-based transformer.**

**Please use `src/transformers/index.ts` instead for new projects.**

**Migration Guide:**
```typescript
// Old (deprecated)
import { StreamingTransformer, ProjectedTransformer } from './transformer';

// New (recommended)
import { createTransformer, WebTransformer } from './transformers';
```

---

This directory contains a TypeScript transliteration of the Python transformer module from `moshi/moshi/modules/transformer.py`. The implementation provides equivalent functionality using JavaScript/TypeScript with TypedArrays for numerical operations.

## Files

- `transformer.ts` - Main transformer implementation
- `transformer.test.ts` - Unit tests for the transformer classes
- `transformer-examples.ts` - Usage examples and demonstrations

## Features

The TypeScript implementation includes:

### Core Classes

1. **TransformerState** - Manages streaming state with offsets for autoregressive generation
2. **StreamingTransformer** - Main transformer class with streaming support
3. **ProjectedTransformer** - Wrapper that handles input/output dimension projections

### Tensor Operations

- **TensorUtils** - Basic tensor operations using Float32Array
  - `zeros()` - Create zero-filled tensors
  - `arange()` - Create sequence tensors
  - `view()` - Reshape tensors (supports -1 dimension inference)
  - `transpose()` - Transpose 3D tensors between (B,T,C) and (B,C,T) layouts
  - `add()` - Element-wise tensor addition
  - `scale()` - Scalar multiplication

### Neural Network Components

- **Linear** - Fully connected linear layer with optional bias
- **Identity** - Pass-through layer
- **PositionalEmbedding** - Sinusoidal positional encoding

## Usage Examples

### Basic Transformer

```typescript
import { StreamingTransformer } from './transformer';

const transformer = new StreamingTransformer({
  dModel: 256,
  numHeads: 8,
  numLayers: 6,
  positionalEmbedding: 'sin',
  causal: true
});

// Create input tensor [batch_size, seq_len, dim]
const input = {
  data: new Float32Array(1 * 10 * 256),
  shape: [1, 10, 256],
  device: 'cpu',
  dtype: 'float32'
};

const output = transformer.forward(input);
```

### Projected Transformer with Multiple Outputs

```typescript
import { ProjectedTransformer } from './transformer';

const projTransformer = new ProjectedTransformer({
  inputDimension: 512,      // Input dimension
  outputDimensions: [256, 128], // Multiple output dimensions
  dModel: 1024,             // Internal transformer dimension
  convLayout: false,        // Use (B, T, C) layout
  transformerOptions: {
    numHeads: 16,
    numLayers: 12,
    positionalEmbedding: 'sin'
  }
});

const outputs = projTransformer.forward(input);
// Returns array of tensors with shapes [..., 256] and [..., 128]
```

### Convolution Layout Support

```typescript
const convTransformer = new ProjectedTransformer({
  inputDimension: 64,
  outputDimensions: [32],
  dModel: 128,
  convLayout: true,  // Use (B, C, T) layout
  transformerOptions: {
    numHeads: 8,
    numLayers: 4,
    positionalEmbedding: 'none' // Often disabled for conv-style data
  }
});

// Input shape: [batch, channels, time]
const convInput = {
  data: new Float32Array(1 * 64 * 100),
  shape: [1, 64, 100],
  device: 'cpu',
  dtype: 'float32'
};

const outputs = convTransformer.forward(convInput);
// Output maintains (B, C, T) layout: [1, 32, 100]
```

### Streaming State Management

```typescript
const transformer = new StreamingTransformer({
  dModel: 256,
  numHeads: 8,
  numLayers: 6,
  causal: true
});

// Initialize streaming state
transformer.streamingState = transformer.initStreamingState(batchSize);

// Process chunks sequentially
const chunk1 = createTensor([batchSize, chunkSize, dModel]);
transformer.forward(chunk1); // Updates internal offsets

const chunk2 = createTensor([batchSize, chunkSize, dModel]);  
transformer.forward(chunk2); // Continues from previous position
```

## Configuration Options

### StreamingTransformer Options

- `dModel` - Model dimension (must be divisible by `numHeads`)
- `numHeads` - Number of attention heads
- `numLayers` - Number of transformer layers
- `dimFeedforward` - Feed-forward network dimension (default: 2048)
- `causal` - Enable causal masking for autoregressive models (default: false)
- `context` - Context window size (optional)
- `positionalEmbedding` - Type of positional encoding: 'sin', 'rope', 'sin_rope', or 'none'
- `maxPeriod` - Maximum period for positional encoding (default: 10000)
- `positionalScale` - Scale factor for positional embeddings (default: 1.0)
- `checkpointing` - Enable gradient checkpointing (default: false)

### ProjectedTransformer Options

- `inputDimension` - Input feature dimension
- `outputDimensions` - Array of output dimensions for multiple heads
- `dModel` - Internal transformer dimension
- `convLayout` - Use channel-first layout (B,C,T) vs sequence-first (B,T,C)
- `transformerOptions` - Options passed to underlying StreamingTransformer

## Implementation Notes

### Differences from Python Version

1. **Tensors**: Uses Float32Array instead of PyTorch tensors
2. **Device Support**: Simplified device management (CPU only)
3. **Layers**: Simplified layer implementations (full attention not implemented)
4. **Gradients**: No automatic differentiation (inference-only)
5. **Performance**: Not optimized for large-scale training/inference

### Limitations

- No GPU acceleration
- Simplified attention mechanism (uses Identity layers as placeholders)
- No gradient computation
- Limited tensor broadcasting support
- Basic positional embedding implementation

### Extensibility

The implementation is designed to be extended:

- Replace `Identity` layers with full transformer layers
- Add GPU support using WebGL/WebGPU
- Implement more sophisticated tensor operations
- Add gradient computation for training

## Testing

Run the test suite:

```bash
npx tsx src/transformer.test.ts
```

Run examples:

```bash
npx tsx src/transformer-examples.ts
```

Build and type-check:

```bash
npm run build
npx tsc --noEmit
```

## Architecture Compatibility

This TypeScript implementation maintains API compatibility with the Python version, making it suitable for:

- Web-based inference applications
- JavaScript/TypeScript model serving
- Client-side transformer applications
- Prototyping and experimentation

The core architecture follows the same patterns as the Python implementation while adapting to JavaScript/TypeScript idioms and limitations.