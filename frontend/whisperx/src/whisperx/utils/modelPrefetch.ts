/* Utilities to prefetch/download models into the browser cache (Transformers.js v3) */
import { pipeline } from '@huggingface/transformers';
import { applyHFTokenFromStorage, getHFToken } from './hfAuth';

export type DeviceHint = 'webgpu' | undefined;

export function detectDevice(): DeviceHint {
  return (typeof navigator !== 'undefined' && 'gpu' in navigator) ? 'webgpu' : undefined;
}

// Resolve a single, browser-compatible Whisper model per size
export function resolveWhisperModel(model: string): string {
  const base = 'onnx-community/whisper-';
  switch (model) {
    // HF repo note: the valid repo is whisper-large-v3-turbo (not whisper-large-v3)
    case 'large-v3': return `${base}large-v3-turbo`;
    case 'tiny': return `${base}tiny`;
    case 'tiny.en': return `${base}tiny.en`;
    case 'base': return `${base}base`;
    case 'base.en': return `${base}base.en`;
    case 'small': return `${base}small`;
    case 'small.en': return `${base}small.en`;
    case 'medium': return `${base}medium`;
    case 'medium.en': return `${base}medium.en`;
    case 'large-v1': return `${base}large-v1`;
    case 'large-v2': return `${base}large-v2`;
    default: return `${base}base.en`;
  }
}

// Optionally resolve through a backend mirror if configured
function maybeMirror(modelId: string): string {
  const tryMirror = (s?: string) => {
    if (!s) return undefined;
    const mirror = s.replace(/\/$/, '');
    // Accept absolute (http/https) or relative (e.g., /api/hf)
    if (/^https?:\/\//.test(mirror) || mirror.startsWith('/')) {
      return `${mirror}/${modelId}`;
    }
    return undefined;
  };
  try {
    // Vite client env
    const m = tryMirror(import.meta?.env?.VITE_HF_MIRROR as string | undefined);
    if (m) return m;
  } catch {}
  try {
    // Next.js client env
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = tryMirror((typeof process !== 'undefined' ? (process as any).env?.NEXT_PUBLIC_HF_MIRROR : undefined) as string | undefined);
    if (m) return m;
  } catch {}
  return modelId;
}

// For speech models, prefer vocab.json over tokenizer.json when probing repo files
async function probeTokenizerFiles(modelId: string, onLog?: (msg: string) => void): Promise<boolean> {
  const base = `https://huggingface.co/${modelId}/resolve/main`;
  const candidates = [
    'vocab.json',          // speech models (e.g., wav2vec2 / CTC)
    'tokenizer.json',      // text models
    'preprocessor_config.json', // Whisper repos often include this
    'config.json',
  ];
  const token = getHFToken();
  const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
  for (const file of candidates) {
    const url = `${base}/${file}`;
    try {
      const resp = await fetch(url, { method: 'HEAD', headers });
      if (resp.ok) {
        onLog?.(`Found ${file} in ${modelId}`);
        return true;
      }
      if (resp.status === 401 || resp.status === 403) {
        onLog?.(`Auth required to access ${file} in ${modelId}`);
      } else if (resp.status === 404) {
        onLog?.(`Missing ${file} in ${modelId} (404)`);
      }
    } catch (e) {
      void e; // ignore network failures; the pipeline call will still attempt to load
    }
  }
  onLog?.(`No vocab.json/tokenizer.json detected for ${modelId} (continuing)`);
  return false;
}

export async function prefetchWhisper(model: string, device: DeviceHint, onLog?: (msg: string) => void) {
  // Ensure any previously saved HF token is applied to the Transformers env
  applyHFTokenFromStorage();

  const resolved = resolveWhisperModel(model);
  const modelId = maybeMirror(resolved);
  // Probe tokenizer files (logs only). Do not alter control flow.
  // Only probe upstream to avoid mirror differences
  await probeTokenizerFiles(resolved, onLog);
  onLog?.(`Downloading Whisper model: ${modelId} (${device ?? 'wasm'})`);
  try {
    const asr = await pipeline('automatic-speech-recognition', modelId, { device });
    // Trigger weight load with 0.5s of silence
    const silence = new Float32Array(8000);
    await asr(silence).catch(() => {});
    onLog?.('Whisper model cached');
  } catch (e) {
    let msg: string;
    if (typeof e === 'object' && e !== null && 'message' in e) {
      msg = String((e as { message?: unknown }).message ?? e);
    } else {
      msg = String(e);
    }

    // Improve guidance on auth failures
    if (/Unauthorized/i.test(msg) || /403/.test(msg)) {
      const hasToken = !!getHFToken();
      const hint = hasToken
        ? 'Your Hugging Face token may lack access to this repository. Ensure you have accepted any model licenses.'
        : 'Add a Hugging Face access token (Save token in controls) and try again.';
      onLog?.(`Failed: ${msg}\nHint: ${hint}`);
    } else if (/404/.test(msg) || /Repository not found/i.test(msg)) {
      onLog?.('Failed: Repository not found. Using "large-v3" maps to onnx-community/whisper-large-v3-turbo.');
    } else {
      onLog?.(`Failed: ${msg}`);
    }
    throw e;
  }
}

function mapAlignmentToHF(name: 'wav2vec2-base' | 'wav2vec2-large'): string {
  if (name === 'wav2vec2-large') return 'Xenova/wav2vec2-large-960h-lv60';
  return 'Xenova/wav2vec2-base-960h';
}

export async function prefetchAlignment(name: 'wav2vec2-base' | 'wav2vec2-large', onLog?: (msg: string) => void) {
  const modelId = mapAlignmentToHF(name);
  onLog?.(`Downloading alignment model: ${modelId}`);
  // Dynamically import to avoid creating a static dependency that blocks code-splitting
  const { AlignmentModel: AlignmentModelReal } = await import('../core/models/AlignmentModelReal');
  const align = new AlignmentModelReal();
  try {
    await align.loadAlignModel('en', 'cpu', modelId);
    onLog?.('Alignment model cached');
  } finally {
    try {
      const maybe = align as unknown as { dispose?: () => void };
      if (typeof maybe.dispose === 'function') maybe.dispose();
    } catch {
      // no-op
    }
  }
}

export async function prefetchSelectedModels(
  whisperModel: string,
  alignmentModel: 'wav2vec2-base' | 'wav2vec2-large',
  onLog?: (msg: string) => void
) {
  const device = detectDevice();
  await prefetchWhisper(whisperModel, device, onLog);
  await prefetchAlignment(alignmentModel, onLog);
}
