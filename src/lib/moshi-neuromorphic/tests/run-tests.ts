#!/usr/bin/env node
/**
 * Test Runner for Moshi Neuromorphic Pipeline
 * 
 * Run with: npx tsx src/lib/moshi-neuromorphic/tests/run-tests.ts
 */

import { runPacketFlowTest, TestPresets } from './PacketFlowTest';

async function main() {
  console.log('🚀 Moshi Neuromorphic Pipeline Test Suite\n');
  
  try {
    // Run quick sine wave test
    console.log('🎵 Running QUICK test (2s sine wave)...');
    await runPacketFlowTest(TestPresets.QUICK);
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Run speech simulation test
    console.log('🗣️  Running SPEECH test (5s speech simulation)...');
    await runPacketFlowTest(TestPresets.SPEECH);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}