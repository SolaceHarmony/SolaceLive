export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isListening: boolean = false;

  constructor() {
    type WebSpeechWindow = Window & typeof globalThis & {
      webkitSpeechRecognition?: new () => SpeechRecognition;
      SpeechRecognition?: new () => SpeechRecognition;
    };
    const w = window as WebSpeechWindow;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (SpeechRecognitionCtor) {
      this.recognition = new SpeechRecognitionCtor();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }

    this.synthesis = window.speechSynthesis;
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      let finalTranscript = '';
      let timeoutId: ReturnType<typeof setTimeout>;

      const stopListening = () => {
        this.recognition!.stop();
        this.isListening = false;
        clearTimeout(timeoutId);
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        clearTimeout(timeoutId);
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          }
        }

        timeoutId = setTimeout(() => {
          if (finalTranscript.trim()) {
            stopListening();
            resolve(finalTranscript.trim());
          }
        }, 1500);
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        stopListening();
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      this.recognition.onend = () => {
        if (finalTranscript.trim()) {
          resolve(finalTranscript.trim());
        } else {
          reject(new Error('No speech detected'));
        }
      };

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.recognition!.start();
        this.isListening = true;
      };

      audio.play().catch(reject);
    });
  }

  startContinuousTranscription(onTranscript: (text: string, isFinal: boolean) => void): void {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported');
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;
        onTranscript(transcript, isFinal);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        setTimeout(() => {
          if (this.isListening) {
            this.recognition!.start();
          }
        }, 100);
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        this.recognition!.start();
      }
    };

    this.recognition.start();
    this.isListening = true;
  }

  stopTranscription(): void {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
    }
  }

  async textToSpeech(text: string, voice?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      if (voice) {
        const voices = this.synthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));

      this.synthesis.speak(utterance);
    });
  }

  async textToSpeechWithElevenLabs(text: string, apiKey: string, voiceId: string = '21m00Tcm4TlvDq8ikWAM'): Promise<Blob> {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error with ElevenLabs TTS:', error);
      throw error;
    }
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }
}

// Minimal SpeechRecognition type declarations
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: Array<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
