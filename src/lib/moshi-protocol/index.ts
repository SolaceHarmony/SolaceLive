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
export * from './audio-processor';

// Transformer architecture
export * from './transformer';

// Re-export decoder worker path for reference
export const DECODER_WORKER_PATH = '/decoderWorker.min.js';
export const DECODER_WASM_PATH = '/decoderWorker.min.wasm';