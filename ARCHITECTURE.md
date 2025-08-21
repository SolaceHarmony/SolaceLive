# SolaceLive Architecture Documentation

## Overview
SolaceLive is a real-time speech-to-text application built with React, TypeScript, and Node.js. It provides multiple transcription approaches including WhisperX implementation, browser-based WebGPU processing, and server-side Hugging Face model inference.

## Tech Stack

### Frontend
- **React 19.1.1** - UI framework
- **TypeScript 5.8.3** - Type safety
- **Vite 7.1.2** - Build tool and dev server
- **TailwindCSS 3.4.14** - Styling
- **@huggingface/transformers 3.0.0** - Browser-based ML models (Whisper runs here!)
- **@livekit/components-react 2.9.14** - LiveKit React components
- **livekit-client 2.15.5** - Real-time communication
- **lucide-react 0.540.0** - Icon library

### Backend  
- **Node.js** with ES modules
- **Express 4.19.2** - Web server
- **@huggingface/transformers 3.0.0** - Server-side ML inference
- **node-wav** - WAV audio processing
- **Multer** - File upload handling
- **CORS** - Cross-origin support

## Project Structure

```
SolaceLive/
├── solace-live/              # Main application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── WhisperXDemo.tsx
│   │   │   ├── TransformersTest.tsx
│   │   │   ├── HFServerTest.tsx
│   │   │   └── ...
│   │   ├── lib/whisperx/    # WhisperX implementation
│   │   │   ├── core/        # Core engine and models
│   │   │   ├── components/  # UI components
│   │   │   ├── context/     # React context
│   │   │   ├── hooks/       # Custom hooks
│   │   │   └── utils/       # Utilities
│   │   ├── services/        # Audio and API services
│   │   ├── types/           # TypeScript definitions
│   │   ├── utils/           # Shared utilities
│   │   │   └── audioUtils.ts      # Audio recording and WAV encoding
│   │   └── App.tsx          # Main application component
│   ├── server/              # Backend server
│   │   └── index.js         # Express API server
│   ├── public/              # Static assets
│   └── package.json
├── whisperX/                # Python WhisperX reference (not used)
└── ARCHITECTURE.md          # This documentation
```

## Architecture Components

### 1. Frontend Application (React)

#### Main App (`App.tsx`)
- Tab-based navigation between three transcription modes:
  1. **WhisperX** - Real-time Whisper in browser + backend processing
  2. **Browser (WebGPU)** - Pure client-side processing with Transformers.js
  3. **Server (HF)** - Server-side only processing

#### WhisperX Implementation
```
lib/whisperx/
├── core/
│   ├── WhisperXEngine.ts     # Main processing engine
│   └── models/
│       ├── FasterWhisperModel.ts  # Whisper transcription
│       ├── VADModelReal.ts        # Voice Activity Detection
│       ├── AlignmentModelReal.ts  # Word alignment
│       ├── DiarizationModel.ts    # Speaker diarization
│       └── SileroVAD.ts          # Silero VAD implementation
├── components/
│   ├── RealtimeControls.tsx      # Recording controls
│   ├── TranscriptionDisplay.tsx  # Display results
│   ├── AudioWaveform.tsx         # Waveform visualization
│   └── SpeakerVisualizer.tsx     # Speaker timeline
├── hooks/
│   └── useWhisperX.ts            # Main hook for WhisperX
└── context/
    └── WhisperXProvider.tsx      # React context provider
```

### 2. Backend Server

#### Express Server (`server/index.js`)
Provides REST API endpoints for ML inference:

```javascript
GET  /health                 # Health check
POST /api/embeddings         # Text embeddings
POST /api/asr                # Speech-to-text (ASR)
POST /api/generate           # Text generation
ALL  /hf/*                   # Hugging Face proxy
```

#### Key Features:
- Accepts WAV audio files or URLs
- Uses Transformers.js for server-side inference
- Configurable model selection
- HuggingFace model caching proxy

### 3. Audio Processing Pipeline

#### Key Components:
- **AudioRecorder** class for managing recording
- **WAV encoding** for backend compatibility
- **Float32Array** processing for Whisper
- **ScriptProcessorNode** for real-time capture

#### Recording Flow:
1. **Microphone Access** → getUserMedia API
2. **Audio Capture** → ScriptProcessorNode (4096 sample buffer)
3. **Real-time Processing** → Continuous streaming to Whisper
4. **Frontend Whisper** → Immediate transcription in browser
5. **Backend Communication** → Send transcribed text (not audio) for further processing

#### Audio Utilities (`utils/audioUtils.ts`):
```typescript
class AudioRecorder {
  - Handles microphone access
  - Chunks audio into segments
  - Converts Float32Array to WAV
}

encodeWAV() - Converts Float32Array to WAV blob
sendAudioToBackend() - Sends audio to /api/asr
```

### 4. Model Integration

#### Whisper Models (FRONTEND - Real-time)
- **Location**: Browser via Transformers.js
- **Purpose**: Immediate speech-to-text, catching every sound
- **Models**: tiny, tiny.en, base, base.en for speed
- **Providers**: Xenova (optimized for browser)
- **Processing**: Continuous, sub-second latency

#### Language Models (BACKEND - TypeScript Server)
- **Location**: Node.js server
- **Purpose**: Understanding, context, generation
- **Models**: Larger models (Qwen, Llama, etc.)
- **Processing**: On transcribed text from frontend

#### VAD (Voice Activity Detection)
- Energy-based detection (simplified)
- Silero VAD structure (ONNX models planned)
- Configurable thresholds and parameters

## Data Flow

### Real-time Transcription Flow:
```
1. User clicks "Start Recording"
2. Browser requests microphone permission
3. AudioRecorder captures audio continuously
4. FRONTEND: Whisper processes audio in real-time
   - Catches every sound immediately (burps, whispers, etc.)
   - Runs Whisper model via Transformers.js in browser
   - Provides instant transcription feedback
5. Transcribed text sent to BACKEND for:
   - Further NLP processing
   - Context understanding
   - Response generation
   - Storage/logging
6. Backend processes with larger models
7. Response sent back to frontend
```

### Configuration:
```typescript
interface WhisperXConfig {
  whisperModel: 'tiny' | 'base' | 'small' | ...
  sampleRate: 16000
  channels: 1
  chunkLength: 5  // seconds
  enableVAD: boolean
  enableAlignment: boolean
  enableDiarization: boolean
}
```

## API Endpoints

### POST /api/asr
**Purpose**: Transcribe audio to text

**Request**:
```javascript
FormData {
  file: Blob (WAV audio)
  body: JSON.stringify({
    modelId: "onnx-community/whisper-base.en",
    sampleRate: 16000
  })
}
```

**Response**:
```json
{
  "text": "Transcribed text here"
}
```

### POST /api/embeddings
**Purpose**: Generate text embeddings

**Request**:
```json
{
  "texts": ["text1", "text2"],
  "modelId": "mixedbread-ai/mxbai-embed-xsmall-v1",
  "dtype": "q4"
}
```

**Response**:
```json
{
  "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]]
}
```

### POST /api/generate
**Purpose**: Generate text completions

**Request**:
```json
{
  "prompt": "Hello, how are",
  "modelId": "onnx-community/Qwen2.5-0.5B-Instruct",
  "max_new_tokens": 256
}
```

**Response**:
```json
{
  "text": "Hello, how are you doing today?"
}
```

## Current State & Issues

### Working:
- ✅ Backend server running on port 8787
- ✅ Frontend dev server on port 5173  
- ✅ Basic audio recording permissions
- ✅ Audio level detection and visualization
- ✅ React component structure with hooks
- ✅ TypeScript type safety throughout
- ✅ WAV encoding for audio data
- ✅ Backend ASR endpoint (can process audio)
- ✅ HuggingFace proxy for model downloads
- ✅ Cross-origin isolation service worker

### Issues to Fix:
1. **Frontend Whisper** needs to run in browser, not send audio to backend
2. **Real-time processing** must be continuous, not chunked  
3. **Text streaming** from frontend to backend (not audio)
4. **Model loading** in browser needs actual Whisper ONNX models
5. **Latency optimization** for instant transcription feedback
6. **WebSocket connection** for bidirectional streaming
7. **VAD integration** with actual Silero models

## Development Setup

### Prerequisites:
- Node.js 18+
- npm or yarn
- Modern browser with WebAudio API support

### Installation:
```bash
cd solace-live
npm install
```

### Running:
```bash
# Start both frontend and backend
npm run dev

# Or separately:
npm run dev:server  # Backend on :8787
npm run dev:client  # Frontend on :5173
```

### Environment Variables:
```bash
HF_TOKEN=hf_xxx        # Optional: Hugging Face token
TFJS_DEVICE=webgpu     # Optional: TensorFlow.js device
PORT=8787              # Optional: Server port
```

## Testing

### Audio Test Page:
Available at `http://localhost:5173/audio-test.html` for isolated audio testing:
- Microphone permission testing
- Audio recording verification  
- WAV encoding validation
- Audio level monitoring
- Debug console with detailed logs
- Playback of recorded audio

### Component Testing:
- **WhisperXDemo**: Full transcription pipeline
- **TransformersTest**: Browser-only Whisper
- **HFServerTest**: Backend-only processing

## Security Considerations

1. **Microphone Permissions**: Required for audio recording
2. **CORS**: Configured for cross-origin requests
3. **File Size Limits**: 25MB max for audio uploads
4. **Service Worker**: COI (Cross-Origin Isolation) for SharedArrayBuffer
5. **HTTPS**: Required for getUserMedia in production

## Performance Optimizations

1. **Chunked Processing**: 5-second audio chunks
2. **Queue System**: Prevents concurrent processing overload
3. **Model Caching**: Models cached after first load
4. **WebGPU**: Uses GPU acceleration when available
5. **Streaming**: Planned WebSocket implementation for real-time

## Future Enhancements

1. **WebSocket Streaming**: Real-time bidirectional text streaming
2. **Actual Silero VAD**: ONNX model integration for better speech detection
3. **Word-level Timestamps**: Alignment model implementation
4. **Speaker Diarization**: Multi-speaker identification
5. **Language Detection**: Auto-detect spoken language
6. **Noise Cancellation**: Advanced audio preprocessing
7. **Model Quantization**: Smaller, faster models (INT8/INT4)
8. **Offline Mode**: Local-only processing option
9. **Moshi Integration**: Future multimodal conversational AI
10. **WebRTC**: Lower latency audio streaming

## Debugging

### Browser Console Commands:
```javascript
// Check audio context
window.AudioContext

// Test microphone
navigator.mediaDevices.getUserMedia({audio: true})

// Check service worker
navigator.serviceWorker.getRegistrations()

// Test backend
fetch('http://localhost:8787/health')
```

### Common Issues:

**Issue**: Microphone permission denied  
**Solution**: Check browser settings, ensure HTTPS in production

**Issue**: Models not loading  
**Solution**: Check network tab, verify HF_TOKEN if needed, check CORS

**Issue**: No audio recorded  
**Solution**: Check audio levels, verify sample rate match (16kHz)

**Issue**: Backend timeout  
**Solution**: Increase timeout, use smaller model (tiny.en)

**Issue**: ScriptProcessorNode deprecated warning  
**Solution**: Known issue, AudioWorklet migration planned

**Issue**: Cross-origin isolation errors  
**Solution**: Service worker should auto-register, check /coi-serviceworker.js

## References

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [WhisperX Original](https://github.com/m-bain/whisperX)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Hugging Face Models](https://huggingface.co/models)