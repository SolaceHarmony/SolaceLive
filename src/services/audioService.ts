import { LocalAudioTrack, Room, RoomEvent, Track } from 'livekit-client';

export class AudioService {
  private room: Room | null = null;
  private audioTrack: LocalAudioTrack | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  constructor() {
    type WebAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const w = window as WebAudioWindow;
    const AudioCtx = w.AudioContext || w.webkitAudioContext;
    if (AudioCtx) {
      this.audioContext = new AudioCtx();
    } else {
      this.audioContext = null;
    }
  }

  async connectToRoom(url: string, token: string): Promise<void> {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 0, height: 0 },
      },
    });

    this.room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        document.body.appendChild(element);
      }
    });

    await this.room.connect(url, token);
  }

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (this.audioContext && stream) {
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
      }

      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();

      if (this.room && this.room.localParticipant && stream) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          this.audioTrack = new LocalAudioTrack(audioTrack, {
            echoCancellation: true,
            noiseSuppression: true,
          });
          await this.room.localParticipant.publishTrack(this.audioTrack);
        }
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();

      if (this.audioTrack && this.room?.localParticipant) {
        this.room.localParticipant.unpublishTrack(this.audioTrack);
        this.audioTrack.stop();
        this.audioTrack = null;
      }

      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    });
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    const sum = dataArray.reduce((a, b) => a + b, 0);
    return sum / dataArray.length / 255;
  }

  async playAudio(audioData: ArrayBuffer | Blob): Promise<void> {
    try {
      const audioBlob = audioData instanceof Blob ? audioData : new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}