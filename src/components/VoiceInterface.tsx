import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, VolumeX, Settings, Loader2 } from 'lucide-react';
import { AudioService } from '../services/audioService';
import { SpeechService } from '../services/speechService';
import { LMStudioService } from '../services/lmStudioService';
import type { TranscriptionMessage, AudioState } from '../types';
import styles from './VoiceInterface.module.css';

interface VoiceInterfaceProps {
  onTranscription?: (message: TranscriptionMessage) => void;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onTranscription }) => {
  const [audioState, setAudioState] = useState<AudioState>({
    isRecording: false,
    isSpeaking: false,
    isProcessing: false,
    audioLevel: 0,
  });

  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioService = useRef(new AudioService());
  const speechService = useRef(new SpeechService());
  const lmService = useRef(new LMStudioService(import.meta.env.VITE_LM_STUDIO_URL || 'http://localhost:1234/v1'));
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    checkLMStudioConnection();
    const audio = audioService.current;
    return () => {
      const frameId = animationFrameRef.current;
      audio.disconnect();
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const checkLMStudioConnection = async () => {
    try {
      const isHealthy = await lmService.current.checkHealth();
      setIsConnected(isHealthy);
      if (!isHealthy) {
        setError('LM Studio not connected. Please start LM Studio with a loaded model.');
      } else {
        setError(null);
      }
    } catch {
      setIsConnected(false);
      setError('Failed to connect to LM Studio');
    }
  };

  const updateAudioLevel = () => {
    if (audioState.isRecording) {
      const level = audioService.current.getAudioLevel();
      setAudioState(prev => ({ ...prev, audioLevel: level }));
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      await audioService.current.startRecording();
      setAudioState(prev => ({ ...prev, isRecording: true }));
      
      speechService.current.startContinuousTranscription((text, isFinal) => {
        if (isFinal && text.trim()) {
          handleTranscription(text.trim());
        }
      });

      updateAudioLevel();
    } catch (err) {
      setError('Failed to start recording');
      console.error(err);
    }
  };

  const stopRecording = async () => {
    try {
      await audioService.current.stopRecording();
      speechService.current.stopTranscription();
      setAudioState(prev => ({ 
        ...prev, 
        isRecording: false, 
        audioLevel: 0 
      }));
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } catch (err) {
      setError('Failed to stop recording');
      console.error(err);
    }
  };

  const handleTranscription = async (text: string) => {
    const userMessage: TranscriptionMessage = {
      id: Date.now().toString(),
      text,
      speaker: 'user',
      timestamp: Date.now(),
    };

    setTranscriptions(prev => [...prev, userMessage]);
    onTranscription?.(userMessage);

    setAudioState(prev => ({ ...prev, isProcessing: true }));

    try {
      let assistantResponse = '';
      const assistantMessage: TranscriptionMessage = {
        id: (Date.now() + 1).toString(),
        text: '',
        speaker: 'assistant',
        timestamp: Date.now(),
        isProcessing: true,
      };

      setTranscriptions(prev => [...prev, assistantMessage]);

      await lmService.current.streamProcessWithLLM(
        text,
        (chunk) => {
          assistantResponse += chunk;
          setTranscriptions(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, text: assistantResponse }
                : msg
            )
          );
        }
      );

      setTranscriptions(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, isProcessing: false }
            : msg
        )
      );

      setAudioState(prev => ({ ...prev, isProcessing: false, isSpeaking: true }));

      await speechService.current.textToSpeech(assistantResponse);

      setAudioState(prev => ({ ...prev, isSpeaking: false }));

      onTranscription?.({
        ...assistantMessage,
        text: assistantResponse,
        isProcessing: false,
      });

    } catch (err) {
      setError('Failed to process with AI');
      setAudioState(prev => ({ ...prev, isProcessing: false, isSpeaking: false }));
      console.error(err);
    }
  };

  const toggleRecording = () => {
    if (audioState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const stopSpeaking = () => {
    speechService.current.stopSpeaking();
    setAudioState(prev => ({ ...prev, isSpeaking: false }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>SolaceLive</h1>
          <p className={styles.subtitle}>AI-Powered Speech Interface</p>
          
          <div className={styles.statusContainer}>
            <div className={`${styles.statusBadge} ${
              isConnected ? styles.statusConnected : styles.statusDisconnected
            }`}>
              <div className={`${styles.statusDot} ${
                isConnected ? styles.statusDotConnected : styles.statusDotDisconnected
              }`} />
              {isConnected ? 'LM Studio Connected' : 'LM Studio Disconnected'}
            </div>
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <button
              onClick={toggleRecording}
              disabled={!isConnected || audioState.isProcessing}
              className={`${styles.mainButton} ${
                audioState.isRecording
                  ? styles.mainButtonRecording
                  : styles.mainButtonIdle
              } ${(!isConnected || audioState.isProcessing) ? styles.mainButtonDisabled : ''}`}
            >
              {audioState.isProcessing ? (
                <Loader2 className={styles.spinner} />
              ) : audioState.isRecording ? (
                <Mic />
              ) : (
                <MicOff />
              )}
            </button>

            {audioState.isRecording && (
              <div 
                className={styles.pulse}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '4px solid rgba(255, 255, 255, 0.3)',
                }}
              />
            )}
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p className={styles.statusText}>
              {audioState.isProcessing
                ? 'Processing...'
                : audioState.isRecording
                ? 'Listening...'
                : audioState.isSpeaking
                ? 'Speaking...'
                : 'Tap to start speaking'}
            </p>
            
            {audioState.isSpeaking && (
              <button onClick={stopSpeaking} className={styles.stopButton}>
                <VolumeX size={16} />
                Stop Speaking
              </button>
            )}
          </div>

          <div className={styles.transcriptions}>
            {transcriptions.slice(-4).map((message) => (
              <div
                key={message.id}
                className={`${styles.transcriptionMessage} ${
                  message.speaker === 'user'
                    ? styles.transcriptionUser
                    : styles.transcriptionAssistant
                }`}
              >
                <div className={styles.transcriptionLabel}>
                  {message.speaker === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className={styles.transcriptionContent}>
                  <span>{message.text}</span>
                  {message.isProcessing && (
                    <Loader2 size={12} className={styles.spinner} style={{ opacity: 0.5 }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={checkLMStudioConnection} className={styles.refreshButton}>
            <Settings size={16} />
            Refresh Connection
          </button>
        </div>
      </div>
    </div>
  );
};