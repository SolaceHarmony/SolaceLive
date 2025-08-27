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
export * from './models/moshi-bridge';
export * from './models/neuromorphic/MoshiKernel';
export * from './models/neuromorphic/ConsciousnessOrchestrator';

// Audio exports
export * from './audio/whisperx';

// Service exports
// Legacy services moved to archive
export * from './services/speechService';
export * from './services/voiceActivityDetection';
export * from './services/whisperWasmService';

// Component exports
// Legacy component moved to archive
export { NeuromorphicVoiceInterface } from './components/NeuromorphicVoiceInterface';
// ConsciousnessMonitor archived; remove export

// Type exports
export * from './types';

// Utility exports
export * from './utils/audioUtils';
export * from './utils/audioFrames';
export * from './utils/logger';
