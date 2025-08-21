/**
 * Main server implementation for Moshi TypeScript server
 * Provides WebSocket-based communication compatible with React client
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

import { createServerTransformer, NodeTransformer, ServerTransformerConfig, ServerTensorUtils } from './transformers/index.js';
import { MessageType, decodeMessage, encodeMessage, createServerInfoMessage } from './protocol/index.js';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  transformer?: NodeTransformer;
  lastActivity: number;
}

class MoshiServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private port: number;

  constructor(port: number = 8088) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.setupExpress();
    this.setupWebSocket();
    this.startCleanupTimer();
  }

  private setupExpress(): void {
    // Enable CORS for all routes
    this.app.use(cors({
      origin: true,
      credentials: true
    }));

    this.app.use(express.json());
    this.app.use(express.static('public'));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connections: this.clients.size,
        memory: process.memoryUsage()
      });
    });

    // Server info endpoint
    this.app.get('/api/info', (req, res) => {
      const serverInfoMessage = createServerInfoMessage();
      const { data } = decodeMessage(serverInfoMessage);
      const serverInfo = JSON.parse(new TextDecoder().decode(data));
      res.json(serverInfo);
    });

    console.log('Express server configured');
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws, request) => {
      const clientId = uuidv4();
      console.log(`New client connected: ${clientId}`);

      const client: ClientConnection = {
        id: clientId,
        ws,
        lastActivity: Date.now()
      };

      this.clients.set(clientId, client);

      // Send server info immediately upon connection
      const serverInfoMessage = createServerInfoMessage();
      ws.send(serverInfoMessage);

      ws.on('message', async (message) => {
        await this.handleClientMessage(clientId, message);
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        const client = this.clients.get(clientId);
        if (client?.transformer) {
          client.transformer.dispose();
        }
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    console.log('WebSocket server configured');
  }

  private async handleClientMessage(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`Message from unknown client: ${clientId}`);
      return;
    }

    client.lastActivity = Date.now();

    try {
      const messageData = new Uint8Array(message);
      const { type, data } = decodeMessage(messageData);

      switch (type) {
        case MessageType.AUDIO:
          await this.handleAudioMessage(client, data);
          break;
        case MessageType.TEXT:
          await this.handleTextMessage(client, data);
          break;
        default:
          console.warn(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`Error handling message from client ${clientId}:`, error);
    }
  }

  private async handleAudioMessage(client: ClientConnection, data: Uint8Array): Promise<void> {
    // Initialize transformer if not already done
    if (!client.transformer) {
      const config: ServerTransformerConfig = {
        modelSize: 'base',
        task: 'audio-processing',
        device: 'cpu',
        precision: 'float32',
        batchSize: 1
      };
      client.transformer = await createServerTransformer(config);
    }

    // Process audio data (mock processing for now)
    // In a real implementation, this would:
    // 1. Decode the audio data (Opus -> PCM)
    // 2. Run it through the audio processing transformer
    // 3. Generate text and audio responses
    // 4. Encode and send back to client

    console.log(`Processing audio message of ${data.length} bytes from client ${client.id}`);

    // Create a mock tensor from audio data
    const audioTensor = ServerTensorUtils.zeros([1, 100, 64], 'float32', 'cpu');
    
    // Process through transformer
    const outputTensor = client.transformer.forward(audioTensor);
    
    // Mock text response
    const textResponse = `Processed audio input of ${data.length} bytes`;
    const textMessage = encodeMessage(MessageType.TEXT, textResponse);
    client.ws.send(textMessage);

    // Mock audio response (echo some data back)
    const audioResponse = new Uint8Array(Math.min(data.length, 1000));
    audioResponse.set(data.slice(0, audioResponse.length));
    const audioMessage = encodeMessage(MessageType.AUDIO, audioResponse);
    client.ws.send(audioMessage);
  }

  private async handleTextMessage(client: ClientConnection, data: Uint8Array): Promise<void> {
    const textInput = new TextDecoder().decode(data);
    console.log(`Received text message from client ${client.id}: "${textInput}"`);

    // Initialize transformer if not already done
    if (!client.transformer) {
      const config: ServerTransformerConfig = {
        modelSize: 'base',
        task: 'text-generation',
        device: 'cpu',
        precision: 'float32',
        batchSize: 1
      };
      client.transformer = await createServerTransformer(config);
    }

    // Process text input through transformer
    const inputTensor = ServerTensorUtils.zeros([1, 10, 256], 'float32', 'cpu');
    const outputTensor = client.transformer.forward(inputTensor);

    // Generate a text response
    const textResponse = `Echo: ${textInput} (processed through TypeScript transformer)`;
    const responseMessage = encodeMessage(MessageType.TEXT, textResponse);
    client.ws.send(responseMessage);
  }

  private startCleanupTimer(): void {
    // Clean up inactive connections every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes

      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastActivity > timeout) {
          console.log(`Cleaning up inactive client: ${clientId}`);
          client.ws.close();
          if (client.transformer) {
            client.transformer.dispose();
          }
          this.clients.delete(clientId);
        }
      }
    }, 60000); // Check every minute
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🚀 Moshi TypeScript Server running on port ${this.port}`);
        console.log(`   WebSocket endpoint: ws://localhost:${this.port}`);
        console.log(`   Health check: http://localhost:${this.port}/health`);
        console.log(`   Server info: http://localhost:${this.port}/api/info`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // Clean up all client transformers
      for (const client of this.clients.values()) {
        if (client.transformer) {
          client.transformer.dispose();
        }
        client.ws.close();
      }
      this.clients.clear();

      this.wss.close(() => {
        this.server.close(() => {
          console.log('🛑 Moshi TypeScript Server stopped');
          resolve();
        });
      });
    });
  }
}

export default MoshiServer;