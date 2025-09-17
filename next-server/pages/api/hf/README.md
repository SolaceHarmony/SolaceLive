# Catch-all Hugging Face Proxy Route

This directory uses Next.js' "catch-all" naming convention: `[...path].ts` means any request matching `/api/hf/**` is routed through that file.

The brackets are part of the file name—no globbing or shell expansion. When working from the terminal, always quote the path (e.g., `cat "pages/api/hf/[...path].ts"`).

The handler proxies requests to Hugging Face while respecting the packet backend's credentials.
