export interface TranscriptionMessage {
  id: string;
  text: string;
  speaker: 'user' | 'assistant';
  timestamp: number;
  isProcessing?: boolean;
}

export interface AudioState {
  isRecording: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  audioLevel: number;
}

export interface AppConfig {
  livekitUrl: string;
  lmStudioUrl: string;
  enableTranscriptions: boolean;
  enableVoice: boolean;
  language: string;
}