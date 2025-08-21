/**
 * Packet WebSocket Server for SolaceLive
 * Handles packet-based streaming protocol for real-time audio/text communication
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');

// Import the packet codec (simplified Node.js version)
class PacketCodec {
  static encode(packet) {
    const header = Buffer.alloc(17);
    
    header.writeUInt8(packet.type, 0);
    header.writeUInt8(packet.priority, 1);
    header.writeUInt32LE(packet.sequenceNumber, 2);
    header.writeDoubleLE(packet.timestamp, 6);
    header.writeUInt16LE(packet.data.length, 14);
    header.writeUInt8(packet.requiresAck ? 1 : 0, 16);
    
    return Buffer.concat([header, packet.data]);
  }
  
  static decode(data) {
    const header = data.slice(0, 17);
    
    return {
      type: header.readUInt8(0),
      priority: header.readUInt8(1),
      sequenceNumber: header.readUInt32LE(2),
      timestamp: header.readDoubleLE(6),
      data: data.slice(17),
      requiresAck: header.readUInt8(16) === 1
    };
  }
}

// Packet types
const PacketType = {
  AUDIO_CHUNK: 0x10,
  TEXT_PARTIAL: 0x20,
  TEXT_FINAL: 0x21,
  METADATA: 0x30,
  HEARTBEAT: 0x01,
  ACK: 0x02
};

const Priority = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

class PacketWebSocketServer {
  constructor(port = 8788) {
    this.port = port;
    this.clients = new Map();
    this.sequenceNumber = 0;
    
    // Create Express app for HTTP endpoints
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        clients: this.clients.size,
        uptime: process.uptime()
      });
    });
    
    // Create HTTP server
    this.server = http.createServer(this.app);
    
    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupWebSocketHandlers();
  }
  
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`[PacketServer] Client ${clientId} connected from ${req.socket.remoteAddress}`);
      
      const client = {
        id: clientId,
        ws: ws,
        sequenceNumber: 0,
        lastHeartbeat: Date.now(),
        stats: {
          packetsReceived: 0,
          packetsSent: 0,
          totalAudioChunks: 0,
          totalTextMessages: 0
        }
      };
      
      this.clients.set(clientId, client);
      
      // Send welcome packet
      this.sendMetadata(client, {
        type: 'connection_established',
        clientId: clientId,
        serverTime: Date.now()
      });
      
      ws.on('message', (data) => {
        this.handleIncomingPacket(client, data);
      });
      
      ws.on('close', () => {
        console.log(`[PacketServer] Client ${clientId} disconnected`);
        this.clients.delete(clientId);
      });
      
      ws.on('error', (error) => {
        console.error(`[PacketServer] Client ${clientId} error:`, error);
      });
      
      // Start heartbeat for this client
      this.startClientHeartbeat(client);
    });
  }
  
  handleIncomingPacket(client, data) {
    try {
      const packet = PacketCodec.decode(data);
      client.stats.packetsReceived++;
      
      console.log(`[PacketServer] Received packet type ${packet.type} from client ${client.id}`);
      
      switch (packet.type) {
        case PacketType.AUDIO_CHUNK:
          this.handleAudioChunk(client, packet);
          break;
          
        case PacketType.TEXT_PARTIAL:
          this.handleTextPartial(client, packet);
          break;
          
        case PacketType.TEXT_FINAL:
          this.handleTextFinal(client, packet);
          break;
          
        case PacketType.METADATA:
          this.handleMetadata(client, packet);
          break;
          
        case PacketType.HEARTBEAT:
          this.handleHeartbeat(client, packet);
          break;
          
        case PacketType.ACK:
          this.handleAck(client, packet);
          break;
          
        default:
          console.warn(`[PacketServer] Unknown packet type: ${packet.type}`);
      }
      
      // Send ACK if required
      if (packet.requiresAck) {
        this.sendAck(client, packet.sequenceNumber);
      }
      
    } catch (error) {
      console.error(`[PacketServer] Error processing packet from client ${client.id}:`, error);
    }
  }
  
  handleAudioChunk(client, packet) {
    client.stats.totalAudioChunks++;
    
    // Convert audio data back to Float32Array
    const audioData = new Float32Array(packet.data.buffer);
    
    console.log(`[PacketServer] Processing audio chunk: ${audioData.length} samples`);
    
    // Simulate CSM processing and generate response
    setTimeout(() => {
      this.simulateCSMResponse(client, audioData);
    }, 50); // Simulate processing delay
  }
  
  handleTextPartial(client, packet) {
    const text = packet.data.toString('utf8');
    console.log(`[PacketServer] Partial text from client ${client.id}: "${text}"`);
    
    // Echo back processed partial text (simulating real-time transcription correction)
    this.sendTextPartial(client, `[Processed] ${text}`);
  }
  
  handleTextFinal(client, packet) {
    const text = packet.data.toString('utf8');
    console.log(`[PacketServer] Final text from client ${client.id}: "${text}"`);
    client.stats.totalTextMessages++;
    
    // Generate AI response
    setTimeout(() => {
      this.generateAIResponse(client, text);
    }, 100);
  }
  
  handleMetadata(client, packet) {
    try {
      const metadata = JSON.parse(packet.data.toString('utf8'));
      console.log(`[PacketServer] Metadata from client ${client.id}:`, metadata);
      
      if (metadata.type === 'conversation_start') {
        this.sendMetadata(client, {
          type: 'conversation_acknowledged',
          config: metadata.config,
          serverCapabilities: {
            audioFormats: ['wav', 'pcm'],
            maxSampleRate: 48000,
            textGeneration: true,
            realTimeStreaming: true
          }
        });
      }
    } catch (error) {
      console.error(`[PacketServer] Error parsing metadata:`, error);
    }
  }
  
  handleHeartbeat(client, packet) {
    client.lastHeartbeat = packet.timestamp;
    // Send heartbeat response
    this.sendHeartbeat(client);
  }
  
  handleAck(client, packet) {
    const ackedSeq = new DataView(packet.data.buffer).getUint32(0, true);
    console.log(`[PacketServer] ACK received for sequence ${ackedSeq}`);
  }
  
  // ========== RESPONSE GENERATION ==========
  
  simulateCSMResponse(client, audioData) {
    // Simulate generating response audio
    const responseAudio = this.generateResponseAudio(audioData.length);
    this.sendAudioChunk(client, responseAudio);
    
    // Also send some text
    this.sendTextPartial(client, 'I can hear you...');
    
    setTimeout(() => {
      this.sendTextFinal(client, 'Thank you for speaking! I processed your audio.');
    }, 500);
  }
  
  generateAIResponse(client, userText) {
    // Simulate AI processing
    const responses = [
      `I understand you said: "${userText}". That's interesting!`,
      `Thank you for sharing: "${userText}". How can I help further?`,
      `I heard: "${userText}". Let me think about that...`,
      `Your message "${userText}" is noted. What would you like to discuss next?`
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // Send streaming response
    const words = response.split(' ');
    words.forEach((word, index) => {
      setTimeout(() => {
        if (index < words.length - 1) {
          this.sendTextPartial(client, word + ' ');
        } else {
          this.sendTextFinal(client, response);
          
          // Generate some response audio
          const responseAudio = this.generateResponseAudio(1024);
          this.sendAudioChunk(client, responseAudio);
        }
      }, index * 200);
    });
  }
  
  generateResponseAudio(length) {
    // Generate simple sine wave audio (placeholder)
    const audioData = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      audioData[i] = 0.1 * Math.sin(2 * Math.PI * 440 * i / 24000); // 440Hz tone
    }
    return audioData;
  }
  
  // ========== PACKET SENDING METHODS ==========
  
  sendPacket(client, packet) {
    if (client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      const encoded = PacketCodec.encode(packet);
      client.ws.send(encoded);
      client.stats.packetsSent++;
      return true;
    } catch (error) {
      console.error(`[PacketServer] Error sending packet to client ${client.id}:`, error);
      return false;
    }
  }
  
  sendAudioChunk(client, audioData) {
    const packet = {
      type: PacketType.AUDIO_CHUNK,
      priority: Priority.CRITICAL,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: Buffer.from(audioData.buffer),
      requiresAck: false
    };
    
    return this.sendPacket(client, packet);
  }
  
  sendTextPartial(client, text) {
    const packet = {
      type: PacketType.TEXT_PARTIAL,
      priority: Priority.NORMAL,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: Buffer.from(text, 'utf8'),
      requiresAck: false
    };
    
    return this.sendPacket(client, packet);
  }
  
  sendTextFinal(client, text) {
    const packet = {
      type: PacketType.TEXT_FINAL,
      priority: Priority.HIGH,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: Buffer.from(text, 'utf8'),
      requiresAck: true
    };
    
    return this.sendPacket(client, packet);
  }
  
  sendMetadata(client, metadata) {
    const packet = {
      type: PacketType.METADATA,
      priority: Priority.LOW,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: Buffer.from(JSON.stringify(metadata), 'utf8'),
      requiresAck: false
    };
    
    return this.sendPacket(client, packet);
  }
  
  sendHeartbeat(client) {
    const packet = {
      type: PacketType.HEARTBEAT,
      priority: Priority.LOW,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: Buffer.alloc(0),
      requiresAck: false
    };
    
    return this.sendPacket(client, packet);
  }
  
  sendAck(client, sequenceNumber) {
    const ackData = Buffer.alloc(4);
    ackData.writeUInt32LE(sequenceNumber, 0);
    
    const packet = {
      type: PacketType.ACK,
      priority: Priority.HIGH,
      sequenceNumber: this.sequenceNumber++,
      timestamp: Date.now(),
      data: ackData,
      requiresAck: false
    };
    
    return this.sendPacket(client, packet);
  }
  
  // ========== CLIENT MANAGEMENT ==========
  
  startClientHeartbeat(client) {
    const heartbeatInterval = setInterval(() => {
      if (client.ws.readyState !== WebSocket.OPEN) {
        clearInterval(heartbeatInterval);
        return;
      }
      
      // Check if client is still alive
      const now = Date.now();
      if (now - client.lastHeartbeat > 30000) { // 30 seconds timeout
        console.log(`[PacketServer] Client ${client.id} timed out`);
        client.ws.terminate();
        clearInterval(heartbeatInterval);
        return;
      }
      
      this.sendHeartbeat(client);
    }, 5000); // Send heartbeat every 5 seconds
  }
  
  generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9);
  }
  
  // ========== SERVER CONTROL ==========
  
  start() {
    this.server.listen(this.port, () => {
      console.log(`[PacketServer] Packet WebSocket Server running on port ${this.port}`);
      console.log(`[PacketServer] WebSocket endpoint: ws://localhost:${this.port}`);
      console.log(`[PacketServer] Health check: http://localhost:${this.port}/health`);
    });
  }
  
  stop() {
    console.log('[PacketServer] Shutting down server...');
    
    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    
    this.wss.close();
    this.server.close();
  }
  
  getServerStats() {
    const stats = {
      clients: this.clients.size,
      totalPacketsSent: 0,
      totalPacketsReceived: 0,
      totalAudioChunks: 0,
      totalTextMessages: 0
    };
    
    for (const client of this.clients.values()) {
      stats.totalPacketsSent += client.stats.packetsSent;
      stats.totalPacketsReceived += client.stats.packetsReceived;
      stats.totalAudioChunks += client.stats.totalAudioChunks;
      stats.totalTextMessages += client.stats.totalTextMessages;
    }
    
    return stats;
  }
}

// Start the server
if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8788;
  const server = new PacketWebSocketServer(port);
  server.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[PacketServer] Received SIGINT, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
  
  // Log stats periodically
  setInterval(() => {
    const stats = server.getServerStats();
    if (stats.clients > 0) {
      console.log(`[PacketServer] Stats - Clients: ${stats.clients}, Packets: ${stats.totalPacketsSent}\u2191 ${stats.totalPacketsReceived}\u2193, Audio: ${stats.totalAudioChunks}, Text: ${stats.totalTextMessages}`);
    }
  }, 10000); // Every 10 seconds
}

module.exports = PacketWebSocketServer;

