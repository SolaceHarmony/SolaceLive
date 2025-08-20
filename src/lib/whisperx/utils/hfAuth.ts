import { env } from '@huggingface/transformers';

const KEY = 'hf_token';

type HFEnv = typeof env & { HF_TOKEN?: string };

declare global {
  interface Window { HF_TOKEN?: string }
}

export function getHFToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? (localStorage.getItem(KEY) || null) : null;
  } catch {
    // Ignore storage access errors (e.g., privacy mode)
    return null;
  }
}

function getHFTokenFromRuntime(): string | null {
  // Prefer localStorage; else check window-injected; else Vite env
  const stored = getHFToken();
  if (stored) return stored;
  try {
    if (typeof window !== 'undefined' && window.HF_TOKEN) return window.HF_TOKEN;
  } catch {
    // ignore
  }
  try {
    // Vite exposes client env via import.meta.env
    const viteToken = import.meta?.env?.VITE_HF_TOKEN as string | undefined;
    return viteToken || null;
  } catch {
    return null;
  }
}

export function setHFToken(token: string): boolean {
  let persisted = false;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, token);
      persisted = true;
    }
  } catch {
    // Ignore storage write errors
  }
  try {
    (env as HFEnv).HF_TOKEN = token;
  } catch {
    // Ignore env assignment errors
  }
  try {
    if (typeof window !== 'undefined') window.HF_TOKEN = token;
  } catch {
    // ignore
  }
  return persisted;
}

export function applyHFTokenFromStorage(): void {
  // Try storage first, then window, then Vite env
  const t = getHFTokenFromRuntime();
  if (!t) return;
  try {
    (env as HFEnv).HF_TOKEN = t;
  } catch {
    // Ignore env assignment errors
  }
  // If token came from non-storage, persist it for subsequent sessions
  const already = getHFToken();
  if (!already) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, t);
    } catch {
      // Ignore storage errors
    }
  }
}
