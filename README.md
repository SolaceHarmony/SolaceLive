# SolaceLive - AI-Powered Speech-to-Speech Interface

A modern React application that provides real-time speech-to-speech conversation using LiveKit for audio handling and LM Studio for local AI processing.

## Features

- 🎤 **Real-time Speech Recognition** - Browser-based speech-to-text using Web Speech API
- 🤖 **Local AI Processing** - Integrates with LM Studio for private, local AI responses
- 🔊 **Text-to-Speech** - Natural voice synthesis for AI responses
- 🎨 **Modern UI** - Beautiful, responsive interface with animations
- 🔒 **Privacy-First** - All processing happens locally, no data sent to external servers
- ⚡ **Real-time Audio** - LiveKit integration for professional audio handling

## Prerequisites

1. **LM Studio** - Download and install from [lmstudio.ai](https://lmstudio.ai/)
2. **Node.js 18+** - For running the React application
3. **Modern Browser** - Chrome, Firefox, Safari, or Edge with Web Speech API support

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure LM Studio

1. Download and open LM Studio
2. Download a model (recommended: Llama 3.2 3B or similar small model for fast responses)
3. Load the model and start the local server
4. Default LM Studio runs on `http://localhost:1234`

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
VITE_LIVEKIT_URL=ws://localhost:7880
VITE_LIVEKIT_API_KEY=your_api_key
VITE_LIVEKIT_API_SECRET=your_api_secret
VITE_LM_STUDIO_URL=http://localhost:1234/v1
```

**Note**: LiveKit configuration is optional for basic functionality. The app will work with just LM Studio for speech-to-speech conversation.

### 4. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage

1. **Start LM Studio** with a loaded model
2. **Open the application** in your browser
3. **Allow microphone permissions** when prompted
4. **Click the microphone button** to start recording
5. **Speak naturally** - the app will transcribe your speech
6. **Listen to AI response** - the AI will respond with synthesized speech

## Architecture

### Core Services

- **AudioService** - Handles audio capture, playback, and LiveKit integration
- **SpeechService** - Manages speech recognition and text-to-speech synthesis
- **LMStudioService** - Interfaces with local LM Studio API for AI processing

### Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **LiveKit** for real-time audio (optional)
- **Axios** for HTTP requests
- **Lucide React** for icons

## Browser Compatibility

- ✅ Chrome 25+
- ✅ Firefox 44+
- ✅ Safari 14.1+
- ✅ Edge 79+

**Note**: Speech recognition requires HTTPS in production or localhost for development.

## Troubleshooting

### LM Studio Connection Issues

1. Ensure LM Studio is running with a model loaded
2. Check that the server is accessible at `http://localhost:1234`
3. Verify the model is responding in LM Studio's chat interface

### Microphone Issues

1. Check browser permissions for microphone access
2. Ensure you're using HTTPS or localhost
3. Try refreshing the page and allowing permissions again

### Audio Issues

1. Check system audio settings
2. Ensure speakers/headphones are connected
3. Try different browsers if issues persist

## Development

### Project Structure

```
src/
├── components/          # React components
│   └── VoiceInterface.tsx
├── services/           # Core service classes
│   ├── audioService.ts
│   ├── lmStudioService.ts
│   └── speechService.ts
├── types/              # TypeScript type definitions
│   └── index.ts
└── App.tsx             # Main application component
```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## License

MIT License - feel free to use this project as a starting point for your own applications.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Future Enhancements

- [ ] Voice activity detection
- [ ] Multiple voice options
- [ ] Conversation history persistence
- [ ] Custom system prompts
- [ ] Integration with more LLM providers
- [ ] Mobile app version
- [ ] Multi-language support
