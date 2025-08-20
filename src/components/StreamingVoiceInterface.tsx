import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, VolumeX, Settings, Loader2, Radio, Activity, Cpu } from 'lucide-react';
import { CSMStreamingService } from '../services/csmStreamingService';
import { SpeechService } from '../services/speechService';
import { VoiceActivityDetection } from '../services/voiceActivityDetection';
import { WhisperWasmService } from '../services/whisperWasmService';
import type { TranscriptionMessage, AudioState } from '../types';
import styles from './VoiceInterface.module.css';

interface StreamingVoiceInterfaceProps {
  onTranscription?: (message: TranscriptionMessage) => void;
}

export const StreamingVoiceInterface: React.FC<StreamingVoiceInterfaceProps> = ({ onTranscription }) => {
  const [audioState, setAudioState] = useState<AudioState>({
    isRecording: false,
    isSpeaking: false,
    isProcessing: false,
    audioLevel: 0,
  });

  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreamingMode, setIsStreamingMode] = useState(true);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [useWhisperWasm, setUseWhisperWasm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStreamingText, setCurrentStreamingText] = useState('');
  const [voiceActivityLevel, setVoiceActivityLevel] = useState(0);
  const [whisperStatus, setWhisperStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('disabled');

  const csmService = useRef(new CSMStreamingService(import.meta.env.VITE_LM_STUDIO_URL || 'http://localhost:1234/v1'));
  const speechService = useRef(new SpeechService());
  const vadService = useRef(new VoiceActivityDetection(0.01, 0.005));
  const whisperService = useRef(new WhisperWasmService());
  const intervalRef = useRef<number | null>(null);
  const currentAudioRef = useRef<ArrayBuffer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    checkCSMConnection();
    initializeWhisperWasm();
    return () => {
      const csm = csmService.current;
      const vad = vadService.current;
      const whisper = whisperService.current;
      const intervalId = intervalRef.current;
      csm.stopStreaming();
      vad.dispose();
      whisper.dispose();
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const initializeWhisperWasm = async () => {
    if (!WhisperWasmService.isSupported()) {
      console.warn('Whisper WASM not supported in this browser');
      setWhisperStatus('error');
      return;
    }

    setWhisperStatus('loading');
    try {
      await whisperService.current.initialize('tiny-en-q5_1');
      setWhisperStatus('ready');
      console.log('Whisper WASM initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Whisper WASM:', error);
      setWhisperStatus('error');
    }
  };

  const checkCSMConnection = async () => {
    try {
      const isHealthy = await csmService.current.checkCSMSupport();
      setIsConnected(isHealthy);
      if (!isHealthy) {
        setError('CSM not supported. Using fallback speech synthesis.');
        setIsStreamingMode(false);
      } else {
        setError(null);
        setIsStreamingMode(true);
      }
    } catch {
      setIsConnected(false);
      setError('Failed to connect to CSM. Check LM Studio configuration.');
      setIsStreamingMode(false);
    }
  };

  const startContinuousRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        currentAudioRef.current = arrayBuffer;
      };

      setAudioState(prev => ({ ...prev, isRecording: true }));
      
      if (isContinuousMode) {
        await startVADMode(stream);
      } else if (isStreamingMode) {
        startStreamingRecognition();
      } else {
        startTraditionalRecognition();
      }

      mediaRecorderRef.current.start(100);
    } catch (err) {
      setError('Failed to start recording');
      console.error(err);
    }
  };

  const startVADMode = async (stream: MediaStream) => {
    try {
      await vadService.current.initialize(stream);
      
      vadService.current.startVAD(
        () => {
          // Speech started
          console.log('VAD: Speech started');
          setAudioState(prev => ({ ...prev, isSpeaking: false, isProcessing: false }));
          audioChunksRef.current = [];
          if (mediaRecorderRef.current?.state === 'paused') {
            mediaRecorderRef.current.resume();
          }
        },
        () => {
          // Speech ended - process the audio
          console.log('VAD: Speech ended');
          if (audioChunksRef.current.length > 0) {
            processVADSpeech();
          }
        },
        (level) => {
          // Voice activity level
          setVoiceActivityLevel(level);
          setAudioState(prev => ({ ...prev, audioLevel: level }));
        }
      );
      
      startStreamingRecognition();
    } catch (err) {
      console.error('Failed to start VAD:', err);
      setError('Voice activity detection failed. Using fallback mode.');
      setIsContinuousMode(false);
      startStreamingRecognition();
    }
  };

  const processVADSpeech = async () => {
    if (audioChunksRef.current.length === 0) return;
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Get transcription using Whisper WASM or fallback
    try {
      let transcription = '';
      
      if (useWhisperWasm && whisperStatus === 'ready') {
        transcription = await whisperService.current.transcribeBlob(audioBlob);
      } else {
        transcription = await speechService.current.transcribeAudio(audioBlob);
      }
      
      if (transcription.trim()) {
        handleStreamingTranscription(transcription.trim(), arrayBuffer);
      }
    } catch (err) {
      console.error('VAD transcription failed:', err);
      // Try fallback method
      if (useWhisperWasm) {
        try {
          const fallbackTranscription = await speechService.current.transcribeAudio(audioBlob);
          if (fallbackTranscription.trim()) {
            handleStreamingTranscription(fallbackTranscription.trim(), arrayBuffer);
          }
        } catch (fallbackErr) {
          console.error('Fallback transcription also failed:', fallbackErr);
        }
      }
    }
    
    // Reset for next speech segment
    audioChunksRef.current = [];
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
  };

  const startStreamingRecognition = () => {
    if (useWhisperWasm && whisperStatus === 'ready') {
      startWhisperStreamingRecognition();
    } else {
      speechService.current.startContinuousTranscription((text, isFinal) => {
        if (isFinal && text.trim() && currentAudioRef.current) {
          handleStreamingTranscription(text.trim(), currentAudioRef.current);
        }
      });
    }
  };

  const startWhisperStreamingRecognition = () => {
    if (whisperStatus !== 'ready') return;

    console.log('Starting Whisper WASM real-time transcription');
    
    // Set up real-time audio processing for Whisper
    const processAudioChunk = async () => {
      if (audioChunksRef.current.length > 0 && !audioState.isProcessing) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        try {
          const audioData = await whisperService.current['arrayBufferToFloat32Array'](arrayBuffer);
          
          await whisperService.current.processStreamingAudio(
            audioData,
            (text, isFinal) => {
              if (text.trim()) {
                if (isFinal) {
                  handleStreamingTranscription(text.trim(), arrayBuffer);
                } else {
                  // Show partial results
                  setCurrentStreamingText(text.trim());
                }
              }
            }
          );
        } catch (err) {
          console.error('Whisper streaming error:', err);
        }
        
        // Clear processed audio chunks
        audioChunksRef.current = audioChunksRef.current.slice(-2); // Keep last 2 chunks for context
      }
    };

    // Process audio chunks regularly
    const processingInterval = window.setInterval(processAudioChunk, 500); // Every 500ms
    // Store interval for cleanup
    intervalRef.current = processingInterval;
  };

  const startTraditionalRecognition = () => {
    speechService.current.startContinuousTranscription((text, isFinal) => {
      if (isFinal && text.trim()) {
        handleTraditionalTranscription(text.trim());
      }
    });
  };

  const handleStreamingTranscription = async (text: string, audioData: ArrayBuffer) => {
    const userMessage: TranscriptionMessage = {
      id: Date.now().toString(),
      text,
      speaker: 'user',
      timestamp: Date.now(),
    };

    setTranscriptions(prev => [...prev, userMessage]);
    onTranscription?.(userMessage);

    setAudioState(prev => ({ ...prev, isProcessing: true }));
    setCurrentStreamingText('');

    const assistantMessage: TranscriptionMessage = {
      id: (Date.now() + 1).toString(),
      text: '',
      speaker: 'assistant',
      timestamp: Date.now(),
      isProcessing: true,
    };

    setTranscriptions(prev => [...prev, assistantMessage]);

    try {
      await csmService.current.generateStreamingResponse(
        text,
        audioData,
        (audioChunk) => {
          // Audio chunk received - CSM handles playback
          console.log('Received audio chunk:', audioChunk.byteLength, 'bytes');
        },
        (textChunk) => {
          // Text chunk received - update UI
          setCurrentStreamingText(prev => prev + textChunk);
          setTranscriptions(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, text: prev + textChunk }
                : msg
            )
          );
        },
        () => {
          // Streaming complete
          setAudioState(prev => ({ ...prev, isProcessing: false, isSpeaking: false }));
          setTranscriptions(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, isProcessing: false }
                : msg
            )
          );
          setCurrentStreamingText('');
        }
      );
    } catch (err) {
      setError('Failed to process with CSM');
      setAudioState(prev => ({ ...prev, isProcessing: false, isSpeaking: false }));
      console.error(err);
    }
  };

  const handleTraditionalTranscription = async (text: string) => {
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
      const response = await fetch(`${import.meta.env.VITE_LM_STUDIO_URL || 'http://localhost:1234/v1'}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'local-model',
          messages: [{ role: 'user', content: text }],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      const data = await response.json();
      const assistantResponse = data.choices[0].message.content;

      const assistantMessage: TranscriptionMessage = {
        id: (Date.now() + 1).toString(),
        text: assistantResponse,
        speaker: 'assistant',
        timestamp: Date.now(),
      };

      setTranscriptions(prev => [...prev, assistantMessage]);
      onTranscription?.(assistantMessage);

      setAudioState(prev => ({ ...prev, isProcessing: false, isSpeaking: true }));
      await speechService.current.textToSpeech(assistantResponse);
      setAudioState(prev => ({ ...prev, isSpeaking: false }));

    } catch (err) {
      setError('Failed to process with LLM');
      setAudioState(prev => ({ ...prev, isProcessing: false }));
      console.error(err);
    }
  };

  const stopRecording = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      speechService.current.stopTranscription();
      csmService.current.stopStreaming();
      vadService.current.stopVAD();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setAudioState(prev => ({ 
        ...prev, 
        isRecording: false, 
        audioLevel: 0 
      }));
      
      setVoiceActivityLevel(0);
      
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    } catch (err) {
      setError('Failed to stop recording');
      console.error(err);
    }
  };

  const toggleRecording = () => {
    if (audioState.isRecording) {
      stopRecording();
    } else {
      startContinuousRecording();
    }
  };

  const stopSpeaking = () => {
    csmService.current.stopStreaming();
    speechService.current.stopSpeaking();
    setAudioState(prev => ({ ...prev, isSpeaking: false }));
  };

  const toggleStreamingMode = async () => {
    const newMode = !isStreamingMode;
    setIsStreamingMode(newMode);
    
    if (newMode) {
      await checkCSMConnection();
    } else {
      setIsConnected(true);
      setError(null);
    }
  };

  const toggleWhisperWasm = async () => {
    if (!useWhisperWasm && whisperStatus !== 'ready') {
      await initializeWhisperWasm();
    }
    setUseWhisperWasm(!useWhisperWasm);
  };

  const toggleContinuousMode = () => {
    setIsContinuousMode(!isContinuousMode);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>SolaceLive</h1>
          <p className={styles.subtitle}>
            {isStreamingMode ? 'Real-time CSM Streaming' : 'Traditional Speech Interface'}
          </p>
          
          <div className={styles.statusContainer}>
            <div className={`${styles.statusBadge} ${
              isConnected ? styles.statusConnected : styles.statusDisconnected
            }`}>
              <div className={`${styles.statusDot} ${
                isConnected ? styles.statusDotConnected : styles.statusDotDisconnected
              }`} />
              {isStreamingMode 
                ? (isConnected ? 'CSM Connected' : 'CSM Disconnected')
                : (isConnected ? 'LM Studio Connected' : 'LM Studio Disconnected')
              }
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={toggleStreamingMode}
                className={styles.refreshButton}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <Radio size={12} />
                {isStreamingMode ? 'Traditional' : 'Streaming'}
              </button>
              
              <button
                onClick={toggleWhisperWasm}
                className={styles.refreshButton}
                style={{ 
                  fontSize: '0.75rem', 
                  padding: '0.25rem 0.5rem',
                  backgroundColor: useWhisperWasm ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)'
                }}
                disabled={whisperStatus === 'loading'}
              >
                {whisperStatus === 'loading' ? (
                  <Loader2 size={12} className={styles.spinner} />
                ) : (
                  <Cpu size={12} />
                )}
                Whisper {useWhisperWasm ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={toggleContinuousMode}
                className={styles.refreshButton}
                style={{ 
                  fontSize: '0.75rem', 
                  padding: '0.25rem 0.5rem',
                  backgroundColor: isContinuousMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <Activity size={12} />
                VAD {isContinuousMode ? 'ON' : 'OFF'}
              </button>
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
                  border: `4px solid ${isStreamingMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.3)'}`,
                }}
              />
            )}
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p className={styles.statusText}>
              {audioState.isProcessing
                ? (isStreamingMode ? 'Streaming...' : 'Processing...')
                : audioState.isRecording
                ? `${isContinuousMode ? 'VAD Active' : (isStreamingMode ? 'Streaming conversation' : 'Listening')}${useWhisperWasm ? ' (Whisper)' : ''}...`
                : audioState.isSpeaking
                ? 'Speaking...'
                : `Tap to start ${isStreamingMode ? 'streaming conversation' : 'speaking'}`}
            </p>
            
            {isContinuousMode && voiceActivityLevel > 0 && (
              <div style={{ 
                width: '200px', 
                height: '4px', 
                backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                borderRadius: '2px', 
                margin: '0.5rem auto',
                overflow: 'hidden'
              }}>
                <div 
                  style={{
                    width: `${Math.min(voiceActivityLevel * 100, 100)}%`,
                    height: '100%',
                    backgroundColor: voiceActivityLevel > 0.01 ? '#4ade80' : '#6b7280',
                    transition: 'width 0.1s ease'
                  }}
                />
              </div>
            )}
            
            {currentStreamingText && (
              <p style={{ 
                color: '#86efac', 
                fontSize: '0.875rem', 
                marginTop: '0.5rem',
                opacity: 0.8 
              }}>
                {currentStreamingText}...
              </p>
            )}
            
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
                  {message.isProcessing && isStreamingMode && (
                    <span style={{ color: '#86efac', marginLeft: '0.5rem' }}>
                      streaming...
                    </span>
                  )}
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

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button onClick={checkCSMConnection} className={styles.refreshButton}>
            <Settings size={16} />
            Refresh Connection
          </button>
        </div>
      </div>
    </div>
  );
};