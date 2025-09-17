// Transformers-like sampling utilities in TypeScript
// Minimal, dependency-free, suitable for Node/Next server-side use

export type SamplingConfig = {
  temperature?: number;        // default 1.0
  top_p?: number;              // default 1.0 (disabled)
  top_k?: number;              // default 0 (disabled)
  repetition_penalty?: number; // default 1.0 (disabled)
  frequency_penalty?: number;  // default 0.0
  presence_penalty?: number;   // default 0.0
  stop_tokens?: number[];      // optional set of stop ids
};

function softmax(logits: number[]): number[] {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const exps = logits.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(v => v / sum);
}

function applyTemperature(logits: number[], temperature: number): number[] {
  if (!isFinite(temperature) || temperature <= 0) return logits.slice();
  const inv = 1 / temperature;
  return logits.map(v => v * inv);
}

function applyRepetitionPenalty(logits: number[], history: number[], penalty: number): number[] {
  if (!history.length || !isFinite(penalty) || penalty === 1.0) return logits.slice();
  const out = logits.slice();
  const seen = new Set(history);
  // HuggingFace behavior: if logit > 0 divide by penalty; if < 0 multiply by penalty
  for (const id of seen) {
    const i = id | 0;
    if (i >= 0 && i < out.length) {
      out[i] = out[i] > 0 ? out[i] / penalty : out[i] * penalty;
    }
  }
  return out;
}

function buildFrequencies(history: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const id of history) m.set(id, (m.get(id) || 0) + 1);
  return m;
}

function applyFrequencyPresencePenalties(logits: number[], history: number[], frequencyPenalty: number, presencePenalty: number): number[] {
  if ((!frequencyPenalty && !presencePenalty) || history.length === 0) return logits.slice();
  const out = logits.slice();
  const freq = buildFrequencies(history);
  for (const [id, count] of freq.entries()) {
    const i = id | 0;
    if (i >= 0 && i < out.length) {
      out[i] -= frequencyPenalty * count + presencePenalty * 1;
    }
  }
  return out;
}

function topKFilter(logits: number[], k: number): number[] {
  if (!k || k <= 0 || k >= logits.length) return logits.slice();
  const indices = logits.map((v, i) => i).sort((a, b) => logits[b] - logits[a]);
  const keep = new Set(indices.slice(0, k));
  const out = logits.slice();
  const NEG_INF = -1e9;
  for (let i = 0; i < out.length; i++) {
    if (!keep.has(i)) out[i] = NEG_INF;
  }
  return out;
}

function topPFilter(logits: number[], p: number): number[] {
  if (!isFinite(p) || p <= 0 || p >= 1) return logits.slice();
  const probs = softmax(logits);
  const idx = probs.map((v, i) => [i, v] as [number, number]).sort((a, b) => b[1] - a[1]);
  const out = logits.slice();
  const NEG_INF = -1e9;
  let cum = 0;
  for (let j = 0; j < idx.length; j++) {
    const pair = idx[j];
    const prob = pair[1];
    cum += prob;
    if (cum > p) {
      for (let k = j + 1; k < idx.length; k++) {
        out[idx[k][0]] = NEG_INF;
      }
      break;
    }
  }
  return out;
}

function multinomial(probs: number[]): number {
  let r = Math.random();
  for (let i = 0; i < probs.length; i++) {
    const p = probs[i];
    if (r < p) return i;
    r -= p;
  }
  return probs.length - 1; // fallback to last
}

export function sampleNextToken(logitsIn: number[], history: number[], cfg: SamplingConfig = {}): number {
  const temperature = cfg.temperature ?? 1.0;
  const top_p = cfg.top_p ?? 1.0;
  const top_k = cfg.top_k ?? 0;
  const repetition_penalty = cfg.repetition_penalty ?? 1.0;
  const frequency_penalty = cfg.frequency_penalty ?? 0.0;
  const presence_penalty = cfg.presence_penalty ?? 0.0;

  let logits = logitsIn.slice();
  logits = applyRepetitionPenalty(logits, history, repetition_penalty);
  logits = applyFrequencyPresencePenalties(logits, history, frequency_penalty, presence_penalty);
  logits = applyTemperature(logits, temperature);
  logits = topKFilter(logits, top_k);
  logits = topPFilter(logits, top_p);
  const probs = softmax(logits);
  const id = multinomial(probs);

  if (cfg.stop_tokens && cfg.stop_tokens.includes(id)) {
    return id; // caller should detect and stop
  }
  return id;
}
