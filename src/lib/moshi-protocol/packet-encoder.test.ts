/**
 * Fine-grained Unit Tests for PacketEncoder
 * Tests every edge case and boundary condition
 */

import { PacketEncoder, PacketType, StreamID, PacketFlags, PacketPriority } from './packets';

describe('PacketEncoder - Header Encoding', () => {
  
  test('should encode version byte correctly', () => {
    const versions = [0, 1, 127, 255];
    versions.forEach(version => {
      const packet = {
        header: {
          version,
          type: PacketType.HEARTBEAT,
          streamId: StreamID.USER,
          sequenceNumber: 0,
          timestamp: BigInt(0),
          flags: PacketFlags.NONE,
          length: 0
        },
        payload: {}
      };
      
      const encoded = PacketEncoder.encode(packet);
      expect(encoded[0]).toBe(version);
    });
  });

  test('should encode all packet types correctly', () => {
    const types = [
      PacketType.HANDSHAKE,
      PacketType.HEARTBEAT,
      PacketType.AUDIO_PCM,
      PacketType.TEXT_PARTIAL,
      PacketType.CSM_EMOTION,
      PacketType.RESPONSE_AUDIO
    ];
    
    types.forEach(type => {
      const packet = {
        header: {
          version: 1,
          type,
          streamId: StreamID.USER,
          sequenceNumber: 0,
          timestamp: BigInt(0),
          flags: PacketFlags.NONE,
          length: 0
        },
        payload: {}
      };
      
      const encoded = PacketEncoder.encode(packet);
      expect(encoded[1]).toBe(type);
    });
  });

  test('should encode stream IDs with correct byte order', () => {
    const packet = {
      header: {
        version: 1,
        type: PacketType.HEARTBEAT,
        streamId: StreamID.AI, // 0x0002
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {}
    };
    
    const encoded = PacketEncoder.encode(packet);
    const view = new DataView(encoded.buffer);
    expect(view.getUint16(2, true)).toBe(StreamID.AI);
  });

  test('should encode sequence numbers up to max uint32', () => {
    const sequences = [0, 1, 65535, 16777215, 4294967295];
    
    sequences.forEach(seq => {
      const packet = {
        header: {
          version: 1,
          type: PacketType.HEARTBEAT,
          streamId: StreamID.USER,
          sequenceNumber: seq,
          timestamp: BigInt(0),
          flags: PacketFlags.NONE,
          length: 0
        },
        payload: {}
      };
      
      const encoded = PacketEncoder.encode(packet);
      const view = new DataView(encoded.buffer);
      expect(view.getUint32(4, true)).toBe(seq);
    });
  });

  test('should encode 64-bit timestamps correctly', () => {
    const timestamps = [
      BigInt(0),
      BigInt(1234567890),
      BigInt('9223372036854775807'), // Max safe BigInt
    ];
    
    timestamps.forEach(ts => {
      const packet = {
        header: {
          version: 1,
          type: PacketType.HEARTBEAT,
          streamId: StreamID.USER,
          sequenceNumber: 0,
          timestamp: ts,
          flags: PacketFlags.NONE,
          length: 0
        },
        payload: {}
      };
      
      const encoded = PacketEncoder.encode(packet);
      const view = new DataView(encoded.buffer);
      expect(view.getBigUint64(8, true)).toBe(ts);
    });
  });

  test('should encode flag combinations correctly', () => {
    const flagCombos = [
      PacketFlags.NONE,
      PacketFlags.ENCRYPTED,
      PacketFlags.COMPRESSED,
      PacketFlags.ENCRYPTED | PacketFlags.COMPRESSED,
      PacketFlags.FRAGMENTED | PacketFlags.FINAL_FRAGMENT,
      PacketFlags.REQUIRES_ACK | PacketFlags.RETRANSMITTED,
      0xFFFF // All flags set
    ];
    
    flagCombos.forEach(flags => {
      const packet = {
        header: {
          version: 1,
          type: PacketType.HEARTBEAT,
          streamId: StreamID.USER,
          sequenceNumber: 0,
          timestamp: BigInt(0),
          flags,
          length: 0
        },
        payload: {}
      };
      
      const encoded = PacketEncoder.encode(packet);
      const view = new DataView(encoded.buffer);
      expect(view.getUint16(16, true)).toBe(flags);
    });
  });

  test('should calculate payload length correctly', () => {
    const payloadSizes = [0, 1, 100, 1000, 65535];
    
    payloadSizes.forEach(size => {
      const payload = new Uint8Array(size);
      const packet = {
        header: {
          version: 1,
          type: PacketType.AUDIO_PCM,
          streamId: StreamID.USER,
          sequenceNumber: 0,
          timestamp: BigInt(0),
          flags: PacketFlags.NONE,
          length: size
        },
        payload: {
          audioData: payload,
          sampleRate: 16000,
          channels: 1,
          encoding: 'pcm' as const,
          duration: 0
        }
      };
      
      const encoded = PacketEncoder.encode(packet);
      const view = new DataView(encoded.buffer);
      expect(view.getUint16(18, true)).toBe(size);
    });
  });

  test('should include optional checksum when provided', () => {
    const checksum = 0xDEADBEEF;
    const packet = {
      header: {
        version: 1,
        type: PacketType.HEARTBEAT,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0,
        checksum
      },
      payload: {}
    };
    
    const encoded = PacketEncoder.encode(packet);
    const view = new DataView(encoded.buffer);
    expect(view.getUint32(20, true)).toBe(checksum);
  });
});

describe('PacketEncoder - Audio Payload Encoding', () => {

  test('should encode Float32Array audio data', () => {
    const samples = 320; // 20ms at 16kHz
    const audioData = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      audioData[i] = Math.sin(2 * Math.PI * 440 * i / 16000);
    }
    
    const packet = {
      header: {
        version: 1,
        type: PacketType.AUDIO_PCM,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: samples * 4
      },
      payload: {
        audioData,
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm' as const,
        duration: 20
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    expect(encoded.length).toBeGreaterThan(24); // Header + metadata + audio
  });

  test('should encode Uint8Array compressed audio', () => {
    const compressedData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    
    const packet = {
      header: {
        version: 1,
        type: PacketType.AUDIO_OPUS,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.COMPRESSED,
        length: compressedData.length
      },
      payload: {
        audioData: compressedData,
        sampleRate: 48000,
        channels: 2,
        encoding: 'opus' as const,
        duration: 20
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    expect(encoded).toContain(0x01);
    expect(encoded).toContain(0x05);
  });

  test('should preserve audio metadata in encoding', () => {
    const metadata = {
      sampleRate: 48000,
      channels: 2,
      encoding: 'opus' as const,
      duration: 20
    };
    
    const packet = {
      header: {
        version: 1,
        type: PacketType.AUDIO_OPUS,
        streamId: StreamID.AI,
        sequenceNumber: 42,
        timestamp: BigInt(1234567890),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {
        audioData: new Uint8Array(0),
        ...metadata
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    // Should contain JSON-encoded metadata
    const metadataStr = JSON.stringify(metadata);
    const metadataBytes = new TextEncoder().encode(metadataStr);
    
    // Check if metadata is present in encoded packet
    let found = false;
    for (let i = 0; i < encoded.length - metadataBytes.length; i++) {
      let match = true;
      for (let j = 0; j < metadataBytes.length; j++) {
        if (encoded[i + j] !== metadataBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe('PacketEncoder - Text Payload Encoding', () => {

  test('should encode ASCII text correctly', () => {
    const text = "Hello, World!";
    const packet = {
      header: {
        version: 1,
        type: PacketType.TEXT_FINAL,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {
        text,
        confidence: 0.95,
        isFinal: true,
        language: 'en'
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    const decoder = new TextDecoder();
    const payloadStr = decoder.decode(encoded.slice(24)); // Skip header
    expect(payloadStr).toContain(text);
  });

  test('should encode Unicode text correctly', () => {
    const texts = [
      "Hello 世界", // Chinese
      "Привет мир", // Russian
      "مرحبا بالعالم", // Arabic
      "🚀🎉💻", // Emojis
      "𝕳𝖊𝖑𝖑𝖔", // Mathematical alphanumeric symbols
    ];
    
    texts.forEach(text => {
      const packet = {
        header: {
          version: 1,
          type: PacketType.TEXT_PARTIAL,
          streamId: StreamID.USER,
          sequenceNumber: 0,
          timestamp: BigInt(0),
          flags: PacketFlags.NONE,
          length: 0
        },
        payload: {
          text,
          confidence: 1.0,
          isFinal: false,
          language: 'mul' // Multiple languages
        }
      };
      
      const encoded = PacketEncoder.encode(packet);
      const payloadStr = new TextDecoder().decode(encoded.slice(24));
      const payload = JSON.parse(payloadStr);
      expect(payload.text).toBe(text);
    });
  });

  test('should encode text with token information', () => {
    const packet = {
      header: {
        version: 1,
        type: PacketType.TEXT_FINAL,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {
        text: "Hello world",
        confidence: 0.98,
        isFinal: true,
        language: 'en',
        tokens: [
          { text: "Hello", start: 0, end: 500, confidence: 0.99 },
          { text: "world", start: 500, end: 1000, confidence: 0.97 }
        ]
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    const payloadStr = new TextDecoder().decode(encoded.slice(24));
    const decoded = JSON.parse(payloadStr);
    expect(decoded.tokens).toHaveLength(2);
    expect(decoded.tokens[0].text).toBe("Hello");
  });
});

describe('PacketEncoder - CSM Payload Encoding', () => {

  test('should encode emotion packets with all fields', () => {
    const packet = {
      header: {
        version: 1,
        type: PacketType.CSM_EMOTION,
        streamId: StreamID.AI,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {
        primary: { emotion: 'joy' as const, intensity: 0.8 },
        secondary: { emotion: 'surprise' as const, intensity: 0.3 },
        valence: 0.7,
        arousal: 0.6,
        confidence: 0.95,
        triggers: ['user_compliment', 'positive_feedback']
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    const payloadStr = new TextDecoder().decode(encoded.slice(24));
    const decoded = JSON.parse(payloadStr);
    
    expect(decoded.primary.emotion).toBe('joy');
    expect(decoded.secondary.emotion).toBe('surprise');
    expect(decoded.triggers).toContain('user_compliment');
  });

  test('should encode context packets with nested objects', () => {
    const packet = {
      header: {
        version: 1,
        type: PacketType.CSM_CONTEXT,
        streamId: StreamID.AI,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {
        contextId: 'ctx_123',
        conversationTurn: 5,
        topics: ['weather', 'sports'],
        entities: [
          { id: 'e1', type: 'location', value: 'New York', confidence: 0.9, mentions: [0, 5] }
        ],
        relationships: [
          { subject: 'e1', predicate: 'located_in', object: 'e2', confidence: 0.85 }
        ],
        temporalContext: {
          currentTime: BigInt(Date.now() * 1000),
          conversationStart: BigInt(Date.now() * 1000 - 300000000),
          lastUserInput: BigInt(Date.now() * 1000 - 5000000),
          lastAIResponse: BigInt(Date.now() * 1000 - 2000000),
          turnDurations: [1000, 2000, 1500]
        }
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    expect(encoded.length).toBeGreaterThan(24);
    
    // Verify complex structure survives encoding
    const payloadStr = new TextDecoder().decode(encoded.slice(24));
    const decoded = JSON.parse(payloadStr);
    expect(decoded.entities[0].type).toBe('location');
    expect(decoded.relationships[0].predicate).toBe('located_in');
  });
});

describe('PacketEncoder - Metadata Encoding', () => {

  test('should encode packet metadata correctly', () => {
    const packet = {
      header: {
        version: 1,
        type: PacketType.HEARTBEAT,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {},
      metadata: {
        priority: PacketPriority.CRITICAL,
        ttl: 5000,
        retryCount: 3,
        correlationId: 'corr_123'
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    // Metadata should be appended after payload
    expect(encoded.length).toBeGreaterThan(24);
    
    // Check priority byte
    expect(encoded[24]).toBe(PacketPriority.CRITICAL);
  });

  test('should encode fragment information', () => {
    const packet = {
      header: {
        version: 1,
        type: PacketType.AUDIO_PCM,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.FRAGMENTED,
        length: 0
      },
      payload: new Uint8Array(100),
      metadata: {
        priority: PacketPriority.NORMAL,
        ttl: 1000,
        retryCount: 0,
        fragmentInfo: {
          fragmentId: 2,
          totalFragments: 5,
          originalLength: 1000
        }
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    expect(encoded.length).toBeGreaterThan(24);
  });
});

describe('PacketEncoder - Stress Tests', () => {

  test('should handle maximum size payloads', () => {
    const maxSize = 65535; // Max uint16
    const largePayload = new Uint8Array(maxSize);
    for (let i = 0; i < maxSize; i++) {
      largePayload[i] = i % 256;
    }
    
    const packet = {
      header: {
        version: 1,
        type: PacketType.AUDIO_PCM,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: maxSize
      },
      payload: {
        audioData: largePayload,
        sampleRate: 48000,
        channels: 1,
        encoding: 'pcm' as const,
        duration: 1000
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    expect(encoded.length).toBeGreaterThan(maxSize);
  });

  test('should encode 1000 packets without memory issues', () => {
    const startMem = (performance as any).memory?.usedJSHeapSize || 0;
    const packets: Uint8Array[] = [];
    
    for (let i = 0; i < 1000; i++) {
      const packet = {
        header: {
          version: 1,
          type: PacketType.AUDIO_PCM,
          streamId: StreamID.USER,
          sequenceNumber: i,
          timestamp: BigInt(i * 20000),
          flags: PacketFlags.NONE,
          length: 320
        },
        payload: {
          audioData: new Float32Array(320),
          sampleRate: 16000,
          channels: 1,
          encoding: 'pcm' as const,
          duration: 20
        }
      };
      
      packets.push(PacketEncoder.encode(packet));
    }
    
    const endMem = (performance as any).memory?.usedJSHeapSize || 0;
    const memIncrease = (endMem - startMem) / 1024 / 1024;
    
    expect(packets).toHaveLength(1000);
    expect(memIncrease).toBeLessThan(100); // Less than 100MB for 1000 packets
  });

  test('should handle rapid successive encoding', () => {
    const startTime = performance.now();
    const iterations = 10000;
    
    for (let i = 0; i < iterations; i++) {
      const packet = {
        header: {
          version: 1,
          type: PacketType.HEARTBEAT,
          streamId: StreamID.SYSTEM,
          sequenceNumber: i,
          timestamp: BigInt(i),
          flags: PacketFlags.NONE,
          length: 0
        },
        payload: {}
      };
      
      PacketEncoder.encode(packet);
    }
    
    const elapsed = performance.now() - startTime;
    const packetsPerSecond = (iterations / elapsed) * 1000;
    
    console.log(`Encoded ${iterations} packets in ${elapsed.toFixed(2)}ms`);
    console.log(`Throughput: ${packetsPerSecond.toFixed(0)} packets/sec`);
    
    expect(packetsPerSecond).toBeGreaterThan(10000); // Should encode >10k packets/sec
  });
});

describe('PacketEncoder - Edge Cases', () => {

  test('should handle empty payloads', () => {
    const packet = {
      header: {
        version: 1,
        type: PacketType.HEARTBEAT,
        streamId: StreamID.SYSTEM,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {}
    };
    
    const encoded = PacketEncoder.encode(packet);
    expect(encoded.length).toBe(24); // Just header, no payload
  });

  test('should handle null/undefined fields gracefully', () => {
    const packet = {
      header: {
        version: 1,
        type: PacketType.TEXT_PARTIAL,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {
        text: '',
        confidence: 0,
        isFinal: false,
        language: '',
        tokens: undefined,
        speakerId: undefined
      }
    };
    
    expect(() => PacketEncoder.encode(packet)).not.toThrow();
  });

  test('should handle special characters in text', () => {
    const specialChars = [
      '\0', // Null character
      '\n\r\t', // Whitespace
      '\\', // Backslash
      '"\'', // Quotes
      '\u0000\uFFFF', // Unicode boundaries
      '�', // Replacement character
    ];
    
    specialChars.forEach(chars => {
      const packet = {
        header: {
          version: 1,
          type: PacketType.TEXT_FINAL,
          streamId: StreamID.USER,
          sequenceNumber: 0,
          timestamp: BigInt(0),
          flags: PacketFlags.NONE,
          length: 0
        },
        payload: {
          text: chars,
          confidence: 1,
          isFinal: true,
          language: 'en'
        }
      };
      
      expect(() => PacketEncoder.encode(packet)).not.toThrow();
    });
  });

  test('should handle extremely long strings', () => {
    const longString = 'A'.repeat(100000); // 100k characters
    
    const packet = {
      header: {
        version: 1,
        type: PacketType.TEXT_FINAL,
        streamId: StreamID.USER,
        sequenceNumber: 0,
        timestamp: BigInt(0),
        flags: PacketFlags.NONE,
        length: 0
      },
      payload: {
        text: longString,
        confidence: 1,
        isFinal: true,
        language: 'en'
      }
    };
    
    const encoded = PacketEncoder.encode(packet);
    expect(encoded.length).toBeGreaterThan(100000);
  });

  test('should maintain precision for floating point values', () => {
    const preciseValues = [
      0.123456789012345,
      Math.PI,
      Math.E,
      Number.MIN_VALUE,
      Number.MAX_VALUE
    ];
    
    preciseValues.forEach(value => {
      const packet = {
        header: {
          version: 1,
          type: PacketType.CSM_EMOTION,
          streamId: StreamID.AI,
          sequenceNumber: 0,
          timestamp: BigInt(0),
          flags: PacketFlags.NONE,
          length: 0
        },
        payload: {
          primary: { emotion: 'neutral' as const, intensity: value },
          valence: value,
          arousal: value,
          confidence: value,
          triggers: []
        }
      };
      
      const encoded = PacketEncoder.encode(packet);
      const payloadStr = new TextDecoder().decode(encoded.slice(24));
      const decoded = JSON.parse(payloadStr);
      
      // JSON might lose some precision, but should be close
      expect(Math.abs(decoded.valence - value)).toBeLessThan(0.0000001);
    });
  });
});