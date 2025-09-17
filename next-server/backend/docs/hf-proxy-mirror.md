# HF Proxy & Model Mirror (Browser WhisperX)

This lightweight proxy lets the browser fetch Hugging Face model assets through your Next.js server, so the server-side `HF_TOKEN` is used for authorization and rate limits are centralized.

## Why

- Avoid exposing tokens in the browser.
- Reduce CORS and rate-limit issues by routing through one origin.
- Keep browser WhisperX prefetches fast and reliable.

## How It Works

- API route: `pages/api/hf/[...path].ts`
  - Proxies `GET`/`HEAD` to `https://huggingface.co/<org>/<repo>/...`
  - Adds server-side `HF_TOKEN` as `Authorization` header
  - Streams the response back to the browser

- Loader: `frontend/whisperx/src/utils/modelPrefetch.ts`
  - Honors `NEXT_PUBLIC_HF_MIRROR` (Next.js) or `VITE_HF_MIRROR` (Vite) as a mirror base
  - Accepts absolute URLs or relative paths (e.g., `/api/hf`)

## Setup

1) Set the server env token (e.g., in `.env.local`):

```
HF_TOKEN=hf_xxx
```

2) Set the client mirror (browser environment):

```
NEXT_PUBLIC_HF_MIRROR=/api/hf
```

3) Build/run Next.js. The WhisperX prefetch will route via `/api/hf` and the server will attach `HF_TOKEN`.

## Example Requests

- Pipeline model prefetch (browser):
  - Original: `https://huggingface.co/onnx-community/whisper-base.en/resolve/main/model.onnx`
  - Via mirror: `/api/hf/onnx-community/whisper-base.en/resolve/main/model.onnx`

## Notes

- This proxy only supports `GET` and `HEAD`.
- Keep `HF_TOKEN` server-side only. Browsers should not have raw tokens.
- For private repos, ensure the token has access and, if needed, that licenses are accepted.
