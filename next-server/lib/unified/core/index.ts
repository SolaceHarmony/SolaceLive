/**
 * Moshi Protocol Integration for SolaceLive
 * Central export point for all Moshi/CSM protocol components
 */

// Core packet types and interfaces
export * from './packets';
export * from './types';

// Packet processing and encoding
export * from './packet-processor';
export * from './encoder';

// Audio processing
// audio-processor moved to archive

// Transformer architecture
// transformer moved to archive (use MLX transformer in models)

// Re-export decoder worker path for reference
export const DECODER_WORKER_PATH = '/decoderWorker.min.js';
export const DECODER_WASM_PATH = '/decoderWorker.min.wasm';
