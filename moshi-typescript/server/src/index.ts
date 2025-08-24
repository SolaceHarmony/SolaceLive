/**
 * Entry point for the Moshi TypeScript Server
 * 
 * This server provides a Node.js/TypeScript implementation of the Moshi transformer
 * that aligns with the React/TypeScript client architecture, making TypeScript
 * a first-class citizen for both client and server-side code.
 */

import MoshiServer from './server.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8088;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function main() {
  console.log('🎵 Starting Moshi TypeScript Server...');
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);

  const server = new MoshiServer(PORT);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n📡 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n📡 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  try {
    await server.start();
    console.log('✅ Server is ready to handle connections');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}