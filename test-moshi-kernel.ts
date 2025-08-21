import { MoshiKernel } from './src/lib/moshi-neuromorphic/MoshiKernel';

// Basic sine wave audio data (as a placeholder)
const sampleRate = 16000; // Hz
const duration = 1; // seconds
const frequency = 440; // Hz (A4 note)
const numSamples = sampleRate * duration;
const sampleAudio = new Float32Array(numSamples);

for (let i = 0; i < numSamples; i++) {
  const time = i / sampleRate;
  sampleAudio[i] = Math.sin(2 * Math.PI * frequency * time);
}

async function runTest() {
  console.log('Initializing MoshiKernel...');
  const moshiKernel = new MoshiKernel();
  // Note: MoshiKernel might need an initialize method if components require async setup

  console.log('Processing sample audio frame...');
  // Assuming processMimiFrame handles framing internally or expects a full frame
  await moshiKernel.processMimiFrame(sampleAudio);

  console.log('Sample audio processing initiated.');
  // Further steps would involve observing ConsciousnessOrchestrator state and metrics
}

runTest();