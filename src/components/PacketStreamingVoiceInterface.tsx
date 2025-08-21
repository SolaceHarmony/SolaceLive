import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, VolumeX, Settings, Loader2, Activity, Cpu, Zap } from 'lucide-react';
import { PacketStreamingService, createStreamingService } from '../services/packetStreamingService';
import { CSMStreamingService } from '../services/csmStreamingService';
import { SpeechService } from '../services/speechService';
import { VoiceActivityDetection } from '../services/voiceActivityDetection';
import { WhisperWasmService } from '../services/whisperWasmService';
import type { TranscriptionMessage, AudioState } from '../types';
import styles from './VoiceInterface.module.css';
import { AudioChunkPlayer } from '../utils/audioPlayer';

interface PacketStreamingVoiceInterfaceProps {
  onTranscription?: (message: TranscriptionMessage) => void;
}

export const PacketStreamingVoiceInterface: React.FC<PacketStreamingVoiceInterfaceProps> = ({ 
  onTranscription 
}) => {
  const [audioState, setAudioState] = useState<AudioState>({
    isRecording: false,
    isSpeaking: false,
    isProcessing: false,
    audioLevel: 0,
  });

  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [usePacketStreaming, setUsePacketStreaming] = useState(true);
  const [packetSupported, setPacketSupported] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [useWhisperWasm, setUseWhisperWasm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStreamingText, setCurrentStreamingText] = useState('');
  const [voiceActivityLevel, setVoiceActivityLevel] = useState(0);
  const [whisperStatus, setWhisperStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('disabled');
  const [streamingStats, setStreamingStats] = useState<any>(null);

  const packetService = useRef<PacketStreamingService | null>(null);
  const fallbackService = useRef(new CSMStreamingService(
    import.meta.env.VITE_LM_STUDIO_URL || 'http://localhost:1234/v1'
  ));
  const speechService = useRef(new SpeechService());
  const vadService = useRef(new VoiceActivityDetection(0.01, 0.005));
  const whisperService = useRef(new WhisperWasmService());
  const intervalRef = useRef<number | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const currentAudioRef = useRef<ArrayBuffer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef(new AudioChunkPlayer(24000));

  useEffect(() => {
    initializeServices();
    initializeWhisperWasm();
    
    return () => {
      cleanup();
      try { audioPlayerRef.current.stop(); } catch {}
    };
  }, []);

  const initializeServices = async () => {
    try {
      // Try to initialize packet streaming
      packetService.current = await createStreamingService({
        // Use default serverUrl from PacketStreamingService (via /packet proxy)
        model: 'gemma3-csm-3',
        temperature: 0.8,
        maxTokens: 2048
      });
      
      setPacketSupported(true);
      setUsePacketStreaming(true);
      setIsConnected(true);
      setError(null);
      
      setupPacketEventHandlers();
      startStatsMonitoring();
      
      console.log('[PacketStreaming] Successfully initialized packet streaming');
    } catch (error) {
      console.warn('[PacketStreaming] Falling back to regular streaming:', error);
      setPacketSupported(false);
      setUsePacketStreaming(false);
      
      // Fallback to regular CSM
      await checkCSMConnection();
    }
  };

  const setupPacketEventHandlers = () => {
    if (!packetService.current) return;

    packetService.current.on('audioChunk', (audioBuffer: ArrayBuffer) => {
      try {
        const f32 = new Float32Array(audioBuffer);
        audioPlayerRef.current.playFloat32(f32);
      } catch (e) {
        console.warn('[PacketStreaming] Audio play error:', e);
      }
      console.log(`[PacketStreaming] Received audio chunk: ${audioBuffer.byteLength} bytes`);
    });

    packetService.current.on('textPartial', (text: string) => {
      setCurrentStreamingText(prev => prev + text);
    });

    packetService.current.on('textFinal', (text: string) => {
      handlePacketTextResponse(text);
    });

    packetService.current.on('metadata', (metadata: unknown) => {
      console.log('[PacketStreaming] Received metadata:', metadata);
    });

    packetService.current.on('conversationComplete', () => {
      setAudioState(prev => ({ ...prev, isProcessing: false, isSpeaking: false }));
      setCurrentStreamingText('');
    });

    packetService.current.on('disconnected', () => {
      setIsConnected(false);
      setError('Packet streaming disconnected');
    });
  };

  const startStatsMonitoring = () => {
    statsIntervalRef.current = window.setInterval(() => {
      if (packetService.current) {
        const stats = packetService.current.getStreamingStats();
        setStreamingStats(stats);
      }
    }, 1000);
  };

  const cleanup = () => {
    if (packetService.current) {
      packetService.current.disconnect();
    }
    
    fallbackService.current.stopStreaming();
    vadService.current.dispose();
    whisperService.current.dispose();
    
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    
    if (statsIntervalRef.current !== null) {
      clearInterval(statsIntervalRef.current);
    }
  };

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
      const isHealthy = await fallbackService.current.checkCSMSupport();
      setIsConnected(isHealthy);
      if (!isHealthy) {
        setError('CSM not supported. Using fallback speech synthesis.');
      } else {
        setError(null);
      }
    } catch {
      setIsConnected(false);
      setError('Failed to connect to CSM. Check LM Studio configuration.');
    }
  };

  const getCurrentStreamingService = () => {
    return usePacketStreaming && packetSupported ? packetService.current : null;
  };

  const startContinuousRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000, // Higher sample rate for packet streaming
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
          
          // Send real-time audio chunks if using packet streaming
          if (usePacketStreaming && packetService.current) {
            processRealtimeAudioChunk(event.data);
          }
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
      } else {
        startStreamingRecognition();
      }

      // Start recording with smaller timeslices for real-time processing
      mediaRecorderRef.current.start(100);
    } catch (err) {
      setError('Failed to start recording');
      console.error(err);
    }
  };

  const processRealtimeAudioChunk = async (audioBlob: Blob) => {
    if (!packetService.current) return;

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioData = new Float32Array(arrayBuffer);
      
      // Send audio chunk via packet protocol
      packetService.current.sendAudioChunk(audioData);
      
    } catch (error) {
      console.error('[PacketStreaming] Error processing audio chunk:', error);
    }
  };

  const startVADMode = async (stream: MediaStream) => {
    try {
      await vadService.current.initialize(stream);
      
      vadService.current.startVAD(
        () => {
          console.log('VAD: Speech started');
          setAudioState(prev => ({ ...prev, isSpeaking: false, isProcessing: false }));
          audioChunksRef.current = [];
          if (mediaRecorderRef.current?.state === 'paused') {
            mediaRecorderRef.current.resume();
          }
        },
        () => {
          console.log('VAD: Speech ended');
          if (audioChunksRef.current.length > 0) {
            processVADSpeech();
          }
        },
        (level) => {
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
    }
    
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
        if (usePacketStreaming && packetService.current) {
          packetService.current.sendPartialTranscription(text);
        }
        
        if (isFinal && text.trim() && currentAudioRef.current) {
          handleStreamingTranscription(text.trim(), currentAudioRef.current);
        }
      });
    }
  };

  const startWhisperStreamingRecognition = () => {
    if (whisperStatus !== 'ready') return;

    console.log('Starting Whisper WASM real-time transcription with packet streaming');
    
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
                if (usePacketStreaming && packetService.current) {
                  packetService.current.sendPartialTranscription(text);
                }
                
                if (isFinal) {
                  handleStreamingTranscription(text.trim(), arrayBuffer);
                } else {
                  setCurrentStreamingText(text.trim());
                }
              }
            }
          );
        } catch (err) {
          console.error('Whisper streaming error:', err);
        }
        
        audioChunksRef.current = audioChunksRef.current.slice(-2);
      }
    };

    const processingInterval = window.setInterval(processAudioChunk, 250); // Faster for packet streaming
    intervalRef.current = processingInterval;
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
      const streamingService = getCurrentStreamingService();
      
      if (streamingService) {
        // Use packet streaming
        await streamingService.generateStreamingResponse(
          text,
          audioData,
          (audioChunk) => {
            console.log('[PacketStreaming] Received audio chunk:', audioChunk.byteLength, 'bytes');
          },
          (textChunk) => {
            setCurrentStreamingText(prev => prev + textChunk);
            setTranscriptions(prev => 
              prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, text: prev.slice(0, -textChunk.length) + textChunk }
                  : msg
              )
            );
          },
          () => {
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
      } else {
        // Fallback to regular CSM streaming
        await fallbackService.current.generateStreamingResponse(
          text,
          audioData,
          (audioChunk) => {
            console.log('Received fallback audio chunk:', audioChunk.byteLength, 'bytes');
          },
          (textChunk) => {
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
      }
    } catch (err) {
      setError(`Failed to process with ${usePacketStreaming ? 'packet streaming' : 'CSM'}`);
      setAudioState(prev => ({ ...prev, isProcessing: false, isSpeaking: false }));
      console.error(err);
    }
  };

  const handlePacketTextResponse = (text: string) => {
    setTranscriptions(prev => {
      const newTranscriptions = [...prev];
      const lastMessage = newTranscriptions[newTranscriptions.length - 1];
      
      if (lastMessage && lastMessage.speaker === 'assistant' && lastMessage.isProcessing) {
        lastMessage.text = text;
        lastMessage.isProcessing = false;
      }
      
      return newTranscriptions;
    });
    
    setCurrentStreamingText('');
  };

  const toggleRecording = async () => {
    if (usePacketStreaming && packetSupported && packetService.current) {
      if (audioState.isRecording) {
        // Stop packet frame capture
        try { packetService.current.stopFrameCapture(); } catch {}
        setAudioState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }));
        setVoiceActivityLevel(0);
      } else {
        // Start packet frame capture (80 ms @ 24kHz)
        try {
          await packetService.current.startFrameCapture();
          setAudioState(prev => ({ ...prev, isRecording: true }));
        } catch (e) {
          setError('Failed to start packet frame capture');
          console.error(e);
        }
      }
      return;
    }

    // Fallback to legacy streaming flow
    if (audioState.isRecording) {
      stopRecording();
    } else {
      startContinuousRecording();
    }
  };

  const stopRecording = async () => {
    try {
      if (usePacketStreaming && packetSupported && packetService.current) {
        try { packetService.current.stopFrameCapture(); } catch {}
      }
      // Legacy path cleanup
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      speechService.current.stopTranscription();
      if (packetService.current && !usePacketStreaming) {
        packetService.current.stopStreaming();
      } else {
        fallbackService.current.stopStreaming();
      }
      vadService.current.stopVAD();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setAudioState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }));
      setVoiceActivityLevel(0);
      if

