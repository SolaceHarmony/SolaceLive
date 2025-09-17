type ChatDelta = {
  audio_tokens?: number[];
  audio?: string;
  content?: string;
  emotional_context?: { emotion?: string; prosody?: unknown; [k: string]: unknown };
};

export class CSMStreamingService {
  private baseUrl: string;
  private isStreaming: boolean = false;
  private audioQueue: ArrayBuffer[] = [];
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;

  constructor(baseUrl: string = 'http://localhost:1234/v1') {
    this.baseUrl = baseUrl;
    type WebAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const w = window as WebAudioWindow;
    const AudioCtx = w.AudioContext || w.webkitAudioContext;
    this.audioContext = AudioCtx ? new AudioCtx() : null;
  }


  async startStreamingConversation(
    text: string,
    onAudioChunk: (audioBuffer: ArrayBuffer) => void,
    onTextChunk?: (textChunk: string) => void,
    referenceAudio?: ArrayBuffer
  ): Promise<void> {
    if (this.isStreaming) {
      this.stopStreaming();
    }

    this.isStreaming = true;
    this.audioQueue = [];

    try {
      const requestBody: Record<string, unknown> = {
        model: 'local-model',
        input: text,
        voice: 'default',
        response_format: 'wav',
        stream: true,
        max_tokens: 500,
        temperature: 0.7,
      };

      if (referenceAudio) {
        const base64Audio = this.arrayBufferToBase64(referenceAudio);
        (requestBody as { reference_audio?: string }).reference_audio = base64Audio;
      }

      const response = await fetch(`${this.baseUrl}/audio/speech/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`CSM API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (this.isStreaming) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              this.isStreaming = false;
              continue;
            }
            
            try {
              const parsed: { audio?: string; text?: string } = JSON.parse(data);

              if (parsed.audio) {
                const audioData = this.base64ToArrayBuffer(parsed.audio);
                this.audioQueue.push(audioData);
                onAudioChunk(audioData);
                this.playAudioChunk(audioData);
              }
              
              if (parsed.text && onTextChunk) {
                onTextChunk(parsed.text);
              }
            } catch (e) {
              console.error('Error parsing CSM chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in CSM streaming:', error);
      this.isStreaming = false;
      throw error;
    }
  }

  async generateStreamingResponse(
    userText: string,
    userAudio: ArrayBuffer,
    onAudioChunk: (audioBuffer: ArrayBuffer) => void,
    onTextChunk?: (text: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    try {
      await this.streamCSMConversation(userText, userAudio, onAudioChunk, onTextChunk);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error generating CSM streaming response:', error);
      throw error;
    }
  }

  private async streamCSMConversation(
    userText: string,
    userAudio: ArrayBuffer,
    onAudioChunk: (audioBuffer: ArrayBuffer) => void,
    onTextChunk?: (text: string) => void
  ): Promise<void> {
    const requestBody = {
      model: 'gemma3-csm-3',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userText
            },
            {
              type: 'audio',
              audio: this.arrayBufferToBase64(userAudio),
              format: 'wav'
            }
          ]
        }
      ],
      stream: true,
      response_format: {
        type: 'audio_text',
        audio_format: 'wav',
        wave_tokens: true,
        emotional_tokens: true,
        prosody_control: true
      },
      audio_generation: {
        use_wave_tokens: true,
        emotional_conditioning: true,
        prosody_modeling: true,
        conversation_context: true,
        speaker_embedding: true
      },
      temperature: 0.8,
      max_audio_tokens: 2048,
      audio_temperature: 0.7,
      wave_token_strategy: 'continuous_generation'
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`CSM API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (this.isStreaming) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            this.isStreaming = false;
            continue;
          }
          
          try {
            const parsed: { choices?: Array<{ delta?: ChatDelta }> } = JSON.parse(data);

            // Handle wave tokens and audio data
            if (parsed.choices?.[0]?.delta?.audio_tokens) {
              const audioData = await this.processWaveTokens(parsed.choices[0].delta.audio_tokens);
              if (audioData) {
                this.audioQueue.push(audioData);
                onAudioChunk(audioData);
                await this.playAudioChunk(audioData);
              }
            }
            
            // Handle direct audio data (fallback)
            if (parsed.choices?.[0]?.delta?.audio) {
              const audioData = this.base64ToArrayBuffer(parsed.choices[0].delta.audio);
              this.audioQueue.push(audioData);
              onAudioChunk(audioData);
              await this.playAudioChunk(audioData);
            }
            
            // Handle text content
            if (parsed.choices?.[0]?.delta?.content && onTextChunk) {
              onTextChunk(parsed.choices[0].delta.content);
            }
            
            // Handle emotional and prosody tokens
            if (parsed.choices?.[0]?.delta?.emotional_context) {
              this.processEmotionalContext(parsed.choices[0].delta!.emotional_context!);
            }
          } catch (e) {
            console.error('Error parsing CSM response:', e);
          }
        }
      }
    }
  }


  private async playAudioChunk(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) return;

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      
      this.sourceNode = source;
    } catch (error) {
      console.error('Error playing audio chunk:', error);
    }
  }

  stopStreaming(): void {
    this.isStreaming = false;
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode = null;
    }
    window.speechSynthesis.cancel();
  }

  pauseStreaming(): void {
    this.isStreaming = false;
    if (this.sourceNode) {
      this.sourceNode.stop();
    }
  }

  resumeStreaming(): void {
    this.isStreaming = true;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  getQueueLength(): number {
    return this.audioQueue.length;
  }

  private async processWaveTokens(waveTokens: number[]): Promise<ArrayBuffer | null> {
    try {
      // Convert wave tokens back to audio using CSM's wave token decoder
      // Wave tokens are quantized audio representations that CSM uses
      const response = await fetch(`${this.baseUrl}/audio/decode-wave-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wave_tokens: waveTokens,
          sample_rate: 24000,
          format: 'wav'
        }),
      });

      if (!response.ok) {
        throw new Error(`Wave token decode error: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      return await audioBlob.arrayBuffer();
    } catch (error) {
      console.error('Error processing wave tokens:', error);
      // Fallback: try to generate audio from tokens directly
      return this.fallbackWaveTokenProcessing(waveTokens);
    }
  }

  private async fallbackWaveTokenProcessing(waveTokens: number[]): Promise<ArrayBuffer | null> {
    try {
      // Simple fallback: convert tokens to basic audio waveform
      const sampleRate = 24000;
      const samples = new Float32Array(waveTokens.length * 100); // Approximate conversion
      
      for (let i = 0; i < waveTokens.length; i++) {
        const tokenValue = (waveTokens[i] / 32768.0) - 1.0; // Normalize to -1 to 1
        const startIdx = i * 100;
        
        for (let j = 0; j < 100; j++) {
          samples[startIdx + j] = tokenValue * Math.sin(2 * Math.PI * 440 * (startIdx + j) / sampleRate);
        }
      }

      // Convert to ArrayBuffer (simplified WAV format)
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);
      
      // WAV header
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + samples.length * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, samples.length * 2, true);
      
      // Audio data
      const offset = 44;
      for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset + i * 2, sample * 0x7FFF, true);
      }
      
      return buffer;
    } catch (error) {
      console.error('Error in fallback wave token processing:', error);
      return null;
    }
  }

  private processEmotionalContext(emotionalContext: { emotion?: string; prosody?: unknown; [k: string]: unknown }): void {
    // Process emotional and prosody information for future use
    // This could be used to adjust audio processing or UI feedback
    console.log('Emotional context:', emotionalContext);
    
    if (emotionalContext.emotion) {
      // Could adjust UI based on detected emotion
      console.log('Detected emotion:', emotionalContext.emotion);
    }
    
    if (emotionalContext.prosody) {
      // Could use prosody information for better audio processing
      console.log('Prosody info:', emotionalContext.prosody);
    }
  }

  async checkCSMSupport(): Promise<boolean> {
    try {
      // Check if the model supports CSM-style streaming with wave tokens
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        const models: Array<{ id: string; capabilities?: string[] }> = data.data || [];
        // Look for CSM model or wave token support
        const hasCSMSupport = models.some((model) =>
           model.id.includes('csm') ||
           model.capabilities?.includes('wave_tokens') ||
           model.capabilities?.includes('audio_generation')
         );

         return hasCSMSupport;
      }
      
      return false;
    } catch (error) {
      console.error('CSM support check failed:', error);
      return false;
    }
  }
}