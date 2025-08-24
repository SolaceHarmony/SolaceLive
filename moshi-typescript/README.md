# Moshi TypeScript Port: a speech-text foundation model for real time dialogue

**A TypeScript port of the Moshi foundation model by The Solace Project**

![precommit badge](https://github.com/SolaceHarmony/moshi-typescript/workflows/precommit/badge.svg)
![ci badge](https://github.com/SolaceHarmony/moshi-typescript/workflows/CI/badge.svg)

[[Read the paper]][moshi] [[Original Demo]](https://moshi.chat) [[Original Hugging Face]](https://huggingface.co/collections/kyutai/moshi-v01-release-66eaeaf3302bef6bd9ad7acd) [[TypeScript Port Repository]](https://github.com/SolaceHarmony/moshi-typescript)

This repository contains a **TypeScript port** of [Moshi][moshi], a speech-text foundation model and **full-duplex** spoken dialogue framework developed by Kyutai Labs. This port is maintained by **The Solace Project** ([@SolaceHarmony](https://github.com/SolaceHarmony)).

[Moshi][moshi] uses [Mimi][moshi], a state-of-the-art streaming neural audio codec. Mimi processes 24 kHz audio, down to a 12.5 Hz representation
with a bandwidth of 1.1 kbps, in a fully streaming manner (latency of 80ms, the frame size),
yet performs better than existing, non-streaming, codecs like
[SpeechTokenizer](https://github.com/ZhangXInFD/SpeechTokenizer) (50 Hz, 4kbps), or [SemantiCodec](https://github.com/haoheliu/SemantiCodec-inference) (50 Hz, 1.3kbps).

 Moshi models **two streams of audio**: one corresponds to Moshi, and the other one to the user.
 At inference, the stream from the user is taken from the audio input,
and the one for Moshi is sampled from the model's output. Along these two audio streams, Moshi predicts text tokens corresponding to its own speech, its **inner monologue**,
which greatly improves the quality of its generation. A small Depth Transformer models inter codebook dependencies for a given time step,
while a large, 7B parameter Temporal Transformer models the temporal dependencies. Moshi achieves a theoretical latency
of 160ms (80ms for the frame size of Mimi + 80ms of acoustic delay), with a practical overall latency as low as 200ms on an L4 GPU.

[Talk to Moshi](https://moshi.chat) on the original demo, or build your own TypeScript implementation using this port.


<p align="center">
<img src="./moshi.png" alt="Schema representing the structure of Moshi. Moshi models two streams of audio:
    one corresponds to Moshi, and the other one to the user. At inference, the audio stream of the user is taken from the audio input, and the audio stream for Moshi is sampled from the model's output. Along that, Moshi predicts text tokens corresponding to its own speech for improved accuracy. A small Depth Transformer models inter codebook dependencies for a given step."
width="650px"></p>

Mimi builds on previous neural audio codecs such as [SoundStream](https://arxiv.org/abs/2107.03312)
and [EnCodec](https://github.com/facebookresearch/encodec), adding a Transformer both in the encoder and decoder,
and adapting the strides to match an overall frame rate of 12.5 Hz. This allows Mimi to get closer to the
average frame rate of text tokens (~3-4 Hz), and limit the number of autoregressive steps in Moshi.
Similarly to SpeechTokenizer, Mimi uses a distillation loss so that the first codebook tokens match
a self-supervised representation from [WavLM](https://arxiv.org/abs/2110.13900), which allows modeling semantic and acoustic information with a single model. Interestingly, while Mimi is fully causal and streaming, it learns to match sufficiently well the non-causal
representation from WavLM, without introducing any delays. Finally, and similarly to [EBEN](https://arxiv.org/pdf/2210.14090),
Mimi uses **only an adversarial training loss**, along with feature matching, showing strong improvements in terms of
subjective quality despite its low bitrate.

<p align="center">
<img src="./mimi.png" alt="Schema representing the structure of Mimi, our proposed neural codec. Mimi contains a Transformer
in both its encoder and decoder, and achieves a frame rate closer to that of text tokens. This allows us to reduce
the number of auto-regressive steps taken by Moshi, thus reducing the latency of the model."
width="800px"></p>



## Organisation of this TypeScript port

This repository contains a TypeScript port of the Moshi inference stack, focusing on web-based implementations:

- The **TypeScript client** implementation is in the [`client/`](client/) directory, providing a React-based web UI with WebRTC audio streaming capabilities.
- **Protocol definitions** and **audio transformers** are implemented in TypeScript for browser compatibility.
- **WebSocket-based communication** for real-time audio streaming between client and server.

For the original implementations:
- The original Python version using PyTorch can be found at [kyutai-labs/moshi](https://github.com/kyutai-labs/moshi) in the `moshi/` directory.
- The original Python version using MLX for M series Macs is in the `moshi_mlx/` directory of the original repo.
- The original Rust version used in production is in the `rust/` directory of the original repo.

If you want to fine tune Moshi, refer to the original [kyutai-labs/moshi-finetune](https://github.com/kyutai-labs/moshi-finetune) repository.


## Models

We release three models:
- our speech codec Mimi,
- Moshi fine-tuned on a male synthetic voice (Moshiko),
- Moshi fine-tuned on a female synthetic voice (Moshika).

Note that this codebase also supports [Hibiki](https://github.com/kyutai-labs/hibiki), check out the dedicated repo for more information.

Depending on the backend, the file format and quantization available will vary. Here is the list
of the HuggingFace repo with each model. Mimi is bundled in each of those, and always use the same checkpoint format.

- Moshika for PyTorch (bf16, int8): [kyutai/moshika-pytorch-bf16](https://huggingface.co/kyutai/moshika-pytorch-bf16), [kyutai/moshika-pytorch-q8](https://huggingface.co/kyutai/moshika-pytorch-q8) (experimental).
- Moshiko for PyTorch (bf16, int8): [kyutai/moshiko-pytorch-bf16](https://huggingface.co/kyutai/moshiko-pytorch-bf16), [kyutai/moshiko-pytorch-q8](https://huggingface.co/kyutai/moshiko-pytorch-q8) (experimental).
- Moshika for MLX (int4, int8, bf16): [kyutai/moshika-mlx-q4](https://huggingface.co/kyutai/moshika-mlx-q4), [kyutai/moshika-mlx-q8](https://huggingface.co/kyutai/moshika-mlx-q8),  [kyutai/moshika-mlx-bf16](https://huggingface.co/kyutai/moshika-mlx-bf16).
- Moshiko for MLX (int4, int8, bf16): [kyutai/moshiko-mlx-q4](https://huggingface.co/kyutai/moshiko-mlx-q4), [kyutai/moshiko-mlx-q8](https://huggingface.co/kyutai/moshiko-mlx-q8),  [kyutai/moshiko-mlx-bf16](https://huggingface.co/kyutai/moshiko-mlx-bf16).
- Moshika for Rust/Candle (int8, bf16): [kyutai/moshika-candle-q8](https://huggingface.co/kyutai/moshika-candle-q8),  [kyutai/moshika-mlx-bf16](https://huggingface.co/kyutai/moshika-candle-bf16).
- Moshiko for Rust/Candle (int8, bf16): [kyutai/moshiko-candle-q8](https://huggingface.co/kyutai/moshiko-candle-q8),  [kyutai/moshiko-mlx-bf16](https://huggingface.co/kyutai/moshiko-candle-bf16).

All models are released under the CC-BY 4.0 license.

## Requirements

### TypeScript Client Requirements

You will need:
- **Node.js** 18.0 or higher (recommended: Node.js 20+)
- **npm** or **yarn** for package management
- A modern web browser with WebRTC support
- For development: TypeScript 5.2+

### Server Requirements (for backend connectivity)

This TypeScript client connects to Moshi servers. You can use:
- The original Python PyTorch server: `pip install -U moshi`
- The original MLX server: `pip install -U moshi_mlx` (Python 3.12 recommended)
- The original Rust server: requires [Rust toolchain](https://rustup.rs/) and optionally CUDA

For detailed server setup, refer to the [original Moshi repository](https://github.com/kyutai-labs/moshi).

### Installation

```bash
# Clone this TypeScript port
git clone https://github.com/SolaceHarmony/moshi-typescript.git
cd moshi-typescript/client

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## TypeScript Client Usage

### Development Mode

```bash
cd client
npm install
npm run dev
```

The development server will start on [localhost:5173](http://localhost:5173) by default. You can connect to any Moshi backend server by specifying the server URL in the web interface.

### Production Build

```bash
cd client
npm run build
```

The built client will be available in the `client/dist` directory and can be served by any static file server.

### Connecting to Moshi Servers

The TypeScript client can connect to various Moshi server implementations:

#### Original Python (PyTorch) Server
```bash
# Install and run the original Python server
pip install -U moshi
python -m moshi.server --hf-repo kyutai/moshiko-pytorch-bf16
# Server runs on localhost:8998
```

#### Original Python (MLX) Server for macOS
```bash
# Install and run MLX server
pip install -U moshi_mlx
python -m moshi_mlx.local_web
# Server runs on localhost:8998
```

#### Original Rust Server
```bash
# From the original repository's rust directory
cargo run --features cuda --bin moshi-backend -r -- --config moshi-backend/config.json standalone
# Server runs on localhost:8998 with HTTPS
```

### Client Configuration

The client supports various configuration options:
- **Queue API Path**: Configure via `VITE_QUEUE_API_PATH` environment variable
- **Worker Address**: Skip queue by visiting `/?worker_addr={WORKER_ADDR}`
- **SSL Certificates**: Place `cert.pem` and `key.pem` in the client root for HTTPS development

For detailed client configuration, see [`client/README.md`](client/README.md).

## Development

### TypeScript Client Development

If you wish to contribute to this TypeScript port or further develop the client:

```bash
# Clone the repository
git clone https://github.com/SolaceHarmony/moshi-typescript.git
cd moshi-typescript/client

# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run prettier

# Run transformer tests
npm run test:transformer

# Build for production
npm run build
```

### Project Structure

```
client/
├── src/
│   ├── protocol/          # WebSocket protocol definitions
│   ├── transformers/      # Audio processing transformers
│   ├── pages/            # React components and pages
│   ├── app.tsx           # Main React application
│   └── transformer.ts    # Core audio transformation logic
├── public/               # Static assets
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

### Original Development

For development on the original Python/Rust implementations, refer to the [original Moshi repository](https://github.com/kyutai-labs/moshi):

```bash
# From the original repo root
pip install -e 'moshi[dev]'
pip install -e 'moshi_mlx[dev]'
pre-commit install
```

## FAQ

Checkout the [Frequently Asked Questions](FAQ.md) section before opening an issue.


## License

### TypeScript Port License

This TypeScript port is provided under the MIT license. See [`client/LICENSE`](client/LICENSE) for details.

### Original Moshi License

The original Moshi code is provided under the MIT license for the Python parts, and Apache license for the Rust backend.
Note that parts of the original code is based on [AudioCraft](https://github.com/facebookresearch/audiocraft), released under
the MIT license.

The weights for the models are released under the CC-BY 4.0 license.

## About This TypeScript Port

This TypeScript implementation is developed and maintained by **The Solace Project** ([@SolaceHarmony](https://github.com/SolaceHarmony)). Our goal is to provide a modern, web-native implementation of the Moshi client that can run directly in browsers with full WebRTC support.

### Features of the TypeScript Port

- **Modern React-based UI** with responsive design
- **WebRTC audio streaming** for low-latency real-time communication  
- **TypeScript protocol definitions** for type-safe client-server communication
- **Modular architecture** with reusable audio transformation components
- **Cross-browser compatibility** with modern web browsers
- **Development tooling** with ESLint, Prettier, and comprehensive build pipeline

### Differences from Original

This TypeScript port focuses specifically on the client-side implementation and web UI. For the core Moshi model inference (server-side), you'll need to use one of the original implementations (Python PyTorch, Python MLX, or Rust) from the [original repository](https://github.com/kyutai-labs/moshi).

## Citation

If you use either the original Moshi or this TypeScript port, please cite the original paper:

```
@techreport{kyutai2024moshi,
      title={Moshi: a speech-text foundation model for real-time dialogue},
      author={Alexandre D\'efossez and Laurent Mazar\'e and Manu Orsini and
      Am\'elie Royer and Patrick P\'erez and Herv\'e J\'egou and Edouard Grave and Neil Zeghidour},
      year={2024},
      eprint={2410.00037},
      archivePrefix={arXiv},
      primaryClass={eess.AS},
      url={https://arxiv.org/abs/2410.00037},
}
```

If you specifically use this TypeScript port, you may also reference:
- **TypeScript Port Repository**: https://github.com/SolaceHarmony/moshi-typescript  
- **Maintained by**: The Solace Project ([@SolaceHarmony](https://github.com/SolaceHarmony))
- **Original Implementation**: https://github.com/kyutai-labs/moshi

[moshi]: https://arxiv.org/abs/2410.00037
