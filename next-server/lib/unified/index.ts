/**
 * Unified SolaceLive Library
 * Single source of truth for all components
 */

// Core exports
export * from './core/packets';
export * from './core/websocket-client';
export * from './core/encoder';
export * from './core/packet-processor';
// Deprecated custom transformer moved to archive
export * from './core/types';

// Model exports
export * from './models/moshi-mlx/transformer';
export * from './models/moshi-mlx/lm';

// Component exports (active UI only)
export { ErrorBoundary } from './components/ErrorBoundary';
export { PacketStreamingVoiceInterface } from './components/PacketStreamingVoiceInterface';

// Type exports
export * from './types';

// Utility exports
export * from './utils/audioUtils';
export * from './utils/audioFrames';
export * from './utils/logger';
