import { promises as fs } from 'fs';
import { Buffer } from 'buffer';
import mlx from '@frost-beta/mlx';
const { core: mx } = mlx;

type GGUFValue = number | string | bigint | boolean | Array<number | bigint>;
type GGUFKV = Record<string, GGUFValue>;
type TensorInfo = { name: string; n_dims: number; dims: number[]; dtype: string; offset: number };

const GGUF_MAGIC = 0x46554747; // 'GGUF'

function readU32LE(buf: Buffer, off: number): number { return buf.readUInt32LE(off); }
function readU64LE(buf: Buffer, off: number): bigint { return buf.readBigUInt64LE(off); }

function align(n: number, a: number): number { const r = n % a; return r === 0 ? n : (n + (a - r)); }

async function readExact(fd: fs.FileHandle, buf: Buffer, offset: number, length: number, position: number) {
  let done = 0;
  while (done < length) {
    const { bytesRead } = await fd.read(buf, offset + done, length - done, position + done);
    if (bytesRead === 0) throw new Error(`Unexpected EOF at ${position + done}`);
    done += bytesRead;
  }
}

function readString(buf: Buffer, off: number): { value: string; next: number } {
  const len = Number(readU64LE(buf, off));
  const start = off + 8;
  const end = start + len;
  const value = buf.toString('utf8', start, end);
  return { value, next: end };
}

function readValue(buf: Buffer, off: number, type: number): { value: GGUFValue; next: number } {
  // GGUF types (subset): 0=uint8, 1=int8, 2=uint16, 3=int16, 4=uint32, 5=int32, 6=uint64, 7=int64,
  // 8=float32, 9=float64, 10=bool, 11=string, 12=array (gguf v3+)
  switch (type) {
    case 0: return { value: buf.readUInt8(off), next: off + 1 };
    case 1: return { value: buf.readInt8(off), next: off + 1 };
    case 2: return { value: buf.readUInt16LE(off), next: off + 2 };
    case 3: return { value: buf.readInt16LE(off), next: off + 2 };
    case 4: return { value: buf.readUInt32LE(off), next: off + 4 };
    case 5: return { value: buf.readInt32LE(off), next: off + 4 };
    case 6: return { value: buf.readBigUInt64LE(off), next: off + 8 };
    case 7: return { value: buf.readBigInt64LE(off), next: off + 8 };
    case 8: return { value: buf.readFloatLE(off), next: off + 4 };
    case 9: return { value: buf.readDoubleLE(off), next: off + 8 };
    case 10: return { value: buf.readUInt8(off) !== 0, next: off + 1 };
    case 11: {
      const { value, next } = readString(buf, off);
      return { value, next };
    }
    case 12: {
      const elType = buf.readUInt32LE(off); // element type
      let p = off + 4;
      const n = Number(readU64LE(buf, p)); p += 8;
      const arr: Array<number | bigint> = [];
      for (let i = 0; i < n; i++) {
        const v = readValue(buf, p, elType); p = v.next;
        arr.push(v.value as any);
      }
      return { value: arr, next: p };
    }
    default:
      throw new Error(`Unsupported GGUF KV type: ${type}`);
  }
}

export async function readGGUF(filePath: string): Promise<{ kv: GGUFKV; tensors: TensorInfo[]; dataOffset: number; filePath: string }> {
  const fd = await fs.open(filePath, 'r');
  try {
    const HEAD_MAX = 64 * 1024 * 1024; // accommodate large headers (names + tensor infos)
    const head = Buffer.alloc(HEAD_MAX);
    const { bytesRead } = await fd.read(head, 0, HEAD_MAX, 0);
    const buf = head.subarray(0, bytesRead);

    let p = 0;
    const magic = buf.readUInt32LE(p); p += 4;
    if (magic !== GGUF_MAGIC) throw new Error('Not a GGUF file (bad magic)');
    const version = buf.readUInt32LE(p); p += 4;
    if (version < 2) throw new Error(`Unsupported GGUF version ${version}`);
    const nTensors = Number(buf.readBigUInt64LE(p)); p += 8;
    const nKV = Number(buf.readBigUInt64LE(p)); p += 8;

    const kv: GGUFKV = {};
    for (let i = 0; i < nKV; i++) {
      const klen = Number(buf.readBigUInt64LE(p)); p += 8;
      const key = buf.toString('utf8', p, p + klen); p += klen;
      const t = buf.readUInt32LE(p); p += 4;
      // value (store minimal parsed forms; arrays of non-strings are skipped to [])
      let v: GGUFValue = 0;
      switch (t) {
        case 0: v = buf.readUInt8(p); p += 1; break; // u8
        case 1: v = buf.readInt8(p); p += 1; break; // i8
        case 2: v = buf.readUInt16LE(p); p += 2; break; // u16
        case 3: v = buf.readInt16LE(p); p += 2; break; // i16
        case 4: v = buf.readUInt32LE(p); p += 4; break; // u32
        case 5: v = buf.readInt32LE(p); p += 4; break; // i32
        case 6: v = buf.readFloatLE(p); p += 4; break; // f32
        case 7: v = buf.readUInt8(p) !== 0; p += 1; break; // bool
        case 8: { // string
          const sl = Number(buf.readBigUInt64LE(p)); p += 8;
          v = buf.toString('utf8', p, p + sl); p += sl;
          break;
        }
        case 9: { // array
          const elType = buf.readUInt32LE(p); p += 4;
          const count = Number(buf.readBigUInt64LE(p)); p += 8;
          if (elType === 8) {
            const out: string[] = [];
            for (let j = 0; j < count; j++) { const sl = Number(buf.readBigUInt64LE(p)); p += 8; out.push(buf.toString('utf8', p, p + sl)); p += sl; }
            v = out as unknown as GGUFValue;
          } else {
            const elSizes: Record<number, number> = { 0:1, 1:1, 2:2, 3:2, 4:4, 5:4, 6:4, 7:1, 10:8, 11:8, 12:8 };
            const sz = elSizes[elType]; if (!sz) throw new Error(`Unsupported GGUF array elType ${elType}`);
            p += sz * count; v = [];
          }
          break;
        }
        case 10: v = buf.readBigUInt64LE(p); p += 8; break; // u64
        case 11: v = buf.readBigInt64LE(p); p += 8; break; // i64
        case 12: v = buf.readDoubleLE(p); p += 8; break; // f64
        default: throw new Error(`Unsupported GGUF KV type: ${t}`);
      }
      kv[key] = v;
      // Do not align here: observed files continue immediately with next klen
    }

    const tensors: TensorInfo[] = [];
    for (let i = 0; i < nTensors; i++) {
      const nlen = Number(buf.readBigUInt64LE(p)); p += 8;
      const name = buf.toString('utf8', p, p + nlen); p += nlen;
      const n_dims = buf.readUInt32LE(p); p += 4;
      const dims: number[] = [];
      for (let d = 0; d < n_dims; d++) { dims.push(Number(buf.readBigUInt64LE(p))); p += 8; }
      const dtypeId = buf.readUInt32LE(p); p += 4;
      const offs = Number(buf.readBigUInt64LE(p)); p += 8;
      tensors.push({ name, n_dims, dims, dtype: ggmlTypeToString(dtypeId), offset: offs });
    }
    const dataOffset = align(p, 32);
    return { kv, tensors, dataOffset, filePath };
  } finally {
    await fd.close();
  }
}

async function readGGUFValue(fd: fs.FileHandle, pos: number, type: number): Promise<{ nextPos: number; value: GGUFValue }>{
  // GGUF v3 types:
  // 0=UINT8, 1=INT8, 2=UINT16, 3=INT16, 4=UINT32, 5=INT32, 6=FLOAT32, 7=BOOL,
  // 8=STRING, 9=ARRAY, 10=UINT64, 11=INT64, 12=FLOAT64
  switch (type) {
    // fixed-size scalars
    case 0: return { nextPos: pos + 1, value: 0 };
    case 1: return { nextPos: pos + 1, value: 0 };
    case 2: return { nextPos: pos + 2, value: 0 };
    case 3: return { nextPos: pos + 2, value: 0 };
    case 4: return { nextPos: pos + 4, value: 0 };
    case 5: return { nextPos: pos + 4, value: 0 };
    case 6: return { nextPos: pos + 4, value: 0 };
    case 7: return { nextPos: pos + 1, value: false };
    case 8: { // string
      const lb = Buffer.alloc(8); await fd.read(lb, 0, 8, pos); pos += 8;
      const slen = Number(lb.readBigUInt64LE(0));
      return { nextPos: pos + slen, value: '' };
    }
    case 9: { // array
      const tb = Buffer.alloc(4); await fd.read(tb, 0, 4, pos); pos += 4;
      const elType = tb.readUInt32LE(0);
      const nb = Buffer.alloc(8); await fd.read(nb, 0, 8, pos); pos += 8;
      const count = Number(nb.readBigUInt64LE(0));
      const elSizes: Record<number, number> = { 0:1, 1:1, 2:2, 3:2, 4:4, 5:4, 6:4, 7:1, 10:8, 11:8, 12:8 };
      if (elType === 8) {
        // array of strings
        let p = pos;
        for (let i = 0; i < count; i++) { const lb = Buffer.alloc(8); await fd.read(lb, 0, 8, p); p += 8; const sl = Number(lb.readBigUInt64LE(0)); p += sl; }
        return { nextPos: p, value: [] };
      }
      const sz = elSizes[elType]; if (!sz) throw new Error(`Unsupported GGUF array elType ${elType}`);
      return { nextPos: pos + sz * count, value: [] };
    }
    case 10: return { nextPos: pos + 8, value: 0n };
    case 11: return { nextPos: pos + 8, value: 0n };
    case 12: return { nextPos: pos + 8, value: 0 };
    default:
      throw new Error(`Unsupported GGUF KV type: ${type}`);
  }
}

function ggmlTypeToString(t: number): string {
  const map: Record<number, string> = {
    // Core float/int
    0: 'F32',
    1: 'F16',
    28: 'F64',
    24: 'I8',
    25: 'I16',
    26: 'I32',
    27: 'I64',
    30: 'BF16',
    // Base quants
    2: 'Q4_0',
    3: 'Q4_1',
    6: 'Q5_0',
    7: 'Q5_1',
    8: 'Q8_0',
    9: 'Q8_1',
    // K-quants
    10: 'Q2_K',
    11: 'Q3_K',
    12: 'Q4_K',
    13: 'Q5_K',
    14: 'Q6_K',
    15: 'Q8_K',
    // Ternary/test quants (optional)
    34: 'TQ1_0',
    35: 'TQ2_0',
  };
  return map[t] ?? `UNK_${t}`;
}

function loadTyped(buf: Buffer, offsetBytes: number, nElems: number, dtype: string): Float32Array {
  const dt = dtype.toUpperCase();
  if (dt === 'F32') {
    // Zero-copy Float32 view over the file-backed buffer
    return new Float32Array(buf.buffer, buf.byteOffset + offsetBytes, nElems);
  }
  if (dt === 'F16') {
    const dv = new DataView(buf.buffer, buf.byteOffset + offsetBytes, nElems * 2);
    const out = new Float32Array(nElems);
    for (let i = 0; i < nElems; i++) { out[i] = halfToFloat(dv.getUint16(i * 2, true)); }
    return out;
  }
  if (dt === 'BF16') {
    const dv = new DataView(buf.buffer, buf.byteOffset + offsetBytes, nElems * 2);
    const out = new Float32Array(nElems);
    for (let i = 0; i < nElems; i++) {
      const b = dv.getUint16(i * 2, true);
      const u32 = b << 16;
      const fView = new DataView(new ArrayBuffer(4));
      fView.setUint32(0, u32, true);
      out[i] = fView.getFloat32(0, true);
    }
    return out;
  }
  throw new Error(`Unsupported GGUF dtype for direct load: ${dtype}`);
}

function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7C00) >> 10;
  const f = h & 0x03FF;
  if (e === 0) return (s ? -1 : 1) * (f / 1024) * Math.pow(2, -14);
  if (e === 0x1F) return f ? NaN : (s ? -Infinity : Infinity);
  return (s ? -1 : 1) * (1 + f / 1024) * Math.pow(2, e - 15);
}

type LoadOpts = {
  maxLayers?: number;
  include?: (logicalName: string) => boolean;
  maxBytesPerTensor?: number;
  progress?: (name: string) => void;
  outDType?: 'f32' | 'f16';
};

export async function loadLmFromGGUF(filePath: string, opts?: LoadOpts): Promise<{ weights: Map<string, mx.array>; meta: { n_layer: number; n_head: number; d_model: number; n_vocab: number; n_kv_head?: number; context_length?: number; ff_length?: number; rope_base?: number; rope_scaling?: { type: 'linear' | 'yarn' | 'dynamic'; factor?: number } | null } }> {
  const { kv, tensors, dataOffset } = await readGGUF(filePath);
  // Extract hparams
  const n_layer = Number((kv['llama.block_count'] ?? kv['gemma3.block_count'] ?? kv['block_count'] ?? kv['n_layer'] ?? 0) as any);
  const n_head = Number((kv['llama.attention.head_count'] ?? kv['gemma3.attention.head_count'] ?? kv['n_head'] ?? 0) as any);
  const d_model = Number((kv['llama.embedding_length'] ?? kv['gemma3.embedding_length'] ?? kv['n_embd'] ?? 0) as any);
  let n_vocab = Number((kv['llama.vocab_size'] ?? kv['gemma3.vocab_size'] ?? kv['vocab_size'] ?? 0) as any);
  if (!n_layer || !n_head || !d_model) throw new Error('GGUF: missing core hparams');
  // Optional meta for extended config mapping
  const n_kv_head0 = Number((kv['llama.attention.head_count_kv'] ?? kv['gemma3.attention.head_count_kv'] ?? (kv as any)['head_count_kv'] ?? 0) as any);
  const n_kv_head = n_kv_head0 > 0 ? n_kv_head0 : undefined;
  const context_length0 = Number((kv['llama.context_length'] ?? kv['gemma3.context_length'] ?? (kv as any)['context_length'] ?? 0) as any);
  const context_length = context_length0 > 0 ? context_length0 : undefined;
  const ff_length0 = Number((kv['llama.feed_forward_length'] ?? kv['gemma3.feed_forward_length'] ?? (kv as any)['feed_forward_length'] ?? 0) as any);
  const ff_length = ff_length0 > 0 ? ff_length0 : undefined;
  const rope_base0 = Number((kv['llama.rope.freq_base'] ?? (kv as any)['gemma3.rope.freq_base'] ?? (kv as any)['rope.freq_base'] ?? (kv as any)['rope_freq_base'] ?? 0) as any);
  const rope_base = rope_base0 > 0 ? rope_base0 : undefined;

  const find = (name: string): TensorInfo | undefined => tensors.find(t => t.name === name);
  const findAny = (names: string[]): TensorInfo | undefined => names.map(find).find(Boolean);

  async function toMx(t: TensorInfo): Promise<mx.array> {
    const dt = t.dtype.toUpperCase();
    const isQuant = dt.startsWith('Q');
    const outer = t.dims.slice(0, t.dims.length - 1).reduce((a, b) => a * b, 1) || 1;
    const last = t.dims[t.dims.length - 1] || 1;
    let outLast = last;
    let readBytes: number;
    let outDims = t.dims.slice();
    if (!isQuant) {
      const bytesPer = dt === 'F32' ? 4 : dt === 'F16' || dt === 'BF16' ? 2 : 0;
      if (!bytesPer) throw new Error(`Unsupported GGUF dtype for direct load: ${dt}`);
      const totalElems = t.dims.reduce((a, b) => a * b, 1);
      const totalBytes = totalElems * bytesPer;
      readBytes = totalBytes;
      if (opts?.maxBytesPerTensor && totalBytes > opts.maxBytesPerTensor) {
        const maxLast = Math.max(1, Math.floor((opts.maxBytesPerTensor / bytesPer) / outer));
        outLast = Math.min(last, maxLast);
        outDims[outDims.length - 1] = outLast;
        readBytes = outer * outLast * bytesPer;
      }
      const fd = await fs.open(filePath, 'r');
      try {
        const buf = Buffer.allocUnsafe(readBytes);
        await fd.read(buf, 0, readBytes, dataOffset + t.offset);
        const outElems = outDims.reduce((a, b) => a * b, 1);
        const f32 = loadTyped(buf, 0, outElems, t.dtype);
        let arr = (mx as any).array ? (mx as any).array(f32).reshape(outDims) : mx.reshape((f32 as unknown as any), outDims);
        if (opts?.outDType === 'f16') {
          try {
            if (typeof (arr as any).astype === 'function') {
              arr = (arr as any).astype('float16');
            } else if (typeof (mx as any).astype === 'function') {
              arr = (mx as any).astype(arr, 'float16');
            }
          } catch (_e) { /* ignore astype failures */ }
        }
        return arr;
      } finally {
        await fd.close();
      }
    }
    // Quantized path
    const qi = getQuantInfo(dt);
    const blocksPerRow = Math.ceil(outLast / qi.qk);
    const rowBytes = blocksPerRow * qi.blkSize;
    readBytes = outer * rowBytes;
    if (opts?.maxBytesPerTensor && readBytes > opts.maxBytesPerTensor) {
      // recompute outLast based on byte budget
      const maxBlocksPerRow = Math.max(1, Math.floor((opts.maxBytesPerTensor / outer) / qi.blkSize));
      outLast = Math.min(last, maxBlocksPerRow * qi.qk);
      outDims[outDims.length - 1] = outLast;
      const blocks2 = Math.ceil(outLast / qi.qk);
      readBytes = outer * (blocks2 * qi.blkSize);
    }
    const fd = await fs.open(filePath, 'r');
    try {
      const buf = Buffer.allocUnsafe(readBytes);
      await fd.read(buf, 0, readBytes, dataOffset + t.offset);
      const out = dequantize(buf, 0, outDims, qi);
      let arr = (mx as any).array ? (mx as any).array(out).reshape(outDims) : mx.reshape((out as unknown as any), outDims);
      if (opts?.outDType === 'f16') {
        try {
          if (typeof (arr as any).astype === 'function') {
            arr = (arr as any).astype('float16');
          } else if (typeof (mx as any).astype === 'function') {
            arr = (mx as any).astype(arr, 'float16');
          }
        } catch {}
      }
      return arr;
    } finally {
      await fd.close();
    }
  }

  function getQuantInfo(dt: string): { qk: number; blkSize: number; type: string } {
    switch (dt) {
      case 'Q4_0': return { qk: 32, blkSize: 2 + 16, type: 'Q4_0' };
      case 'Q4_1': return { qk: 32, blkSize: 2 + 2 + 16, type: 'Q4_1' };
      case 'Q5_0': return { qk: 32, blkSize: 2 + 4 + 16, type: 'Q5_0' };
      case 'Q5_1': return { qk: 32, blkSize: 2 + 2 + 4 + 16, type: 'Q5_1' };
      case 'Q8_0': return { qk: 32, blkSize: 2 + 32, type: 'Q8_0' };
      // K-quants
      case 'Q2_K': return { qk: 256, blkSize: 2 + 2 + (256 / 16) + (256 / 4), type: 'Q2_K' };
      case 'Q3_K': return { qk: 256, blkSize: 2 + (256 / 4) + (256 / 8) + 12, type: 'Q3_K' };
      case 'Q4_K': return { qk: 256, blkSize: 2 + 2 + (256 / 2) + 12, type: 'Q4_K' };
      case 'Q5_K': return { qk: 256, blkSize: 2 + 2 + (256 / 2) + (256 / 8) + 12, type: 'Q5_K' };
      case 'Q6_K': return { qk: 256, blkSize: 2 + (256 / 2) + (256 / 4) + (256 / 16), type: 'Q6_K' };
      case 'Q8_K': return { qk: 256, blkSize: 4 + 256 + (256 / 8), type: 'Q8_K' };
      default:
        throw new Error(`Unsupported quantized dtype: ${dt}`);
    }
  }

  function dequantize(buf: Buffer, offset: number, outDims: number[], qi: { qk: number; blkSize: number; type: string }): Float32Array {
    const outer = outDims.slice(0, outDims.length - 1).reduce((a, b) => a * b, 1) || 1;
    const last = outDims[outDims.length - 1] || 1;
    const out = new Float32Array(outer * last);
    let p = offset;
    let o = 0;
    const qk = qi.qk;
    const nBlocksRow = Math.ceil(last / qk);
    for (let r = 0; r < outer; r++) {
      let remaining = last;
      for (let b = 0; b < nBlocksRow; b++) {
        const take = Math.min(qk, remaining);
        switch (qi.type) {
          case 'Q4_0': {
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            for (let i = 0; i < 16; i++) {
              const qb = buf.readUInt8(p + i);
              if (i * 2 < take) out[o++] = d * ((qb & 0x0F) - 8);
              if (i * 2 + 1 < take) out[o++] = d * ((qb >> 4) - 8);
            }
            p += 16;
            break;
          }
          case 'Q4_1': {
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const m = halfToFloat(buf.readUInt16LE(p)); p += 2;
            for (let i = 0; i < 16; i++) {
              const qb = buf.readUInt8(p + i);
              if (i * 2 < take) out[o++] = m + d * (qb & 0x0F);
              if (i * 2 + 1 < take) out[o++] = m + d * (qb >> 4);
            }
            p += 16;
            break;
          }
          case 'Q5_0': {
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const qh0 = buf.readUInt32LE(p); p += 4; // 32 bits, high bits for 32 values
            for (let i = 0; i < 16; i++) {
              const qb = buf.readUInt8(p + i);
              const k0 = i * 2;
              const k1 = k0 + 1;
              if (k0 < take) {
                const hi = (qh0 >> k0) & 1;
                const lo = (qb & 0x0F);
                const q = lo | (hi << 4);
                out[o++] = d * (q - 16);
              }
              if (k1 < take) {
                const hi = (qh0 >> k1) & 1;
                const lo = (qb >> 4);
                const q = lo | (hi << 4);
                out[o++] = d * (q - 16);
              }
            }
            p += 16;
            break;
          }
          case 'Q5_1': {
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const m = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const qh0 = buf.readUInt32LE(p); p += 4;
            for (let i = 0; i < 16; i++) {
              const qb = buf.readUInt8(p + i);
              const k0 = i * 2;
              const k1 = k0 + 1;
              if (k0 < take) {
                const hi = (qh0 >> k0) & 1;
                const lo = (qb & 0x0F);
                const q = lo | (hi << 4);
                out[o++] = m + d * q;
              }
              if (k1 < take) {
                const hi = (qh0 >> k1) & 1;
                const lo = (qb >> 4);
                const q = lo | (hi << 4);
                out[o++] = m + d * q;
              }
            }
            p += 16;
            break;
          }
          case 'Q8_0': {
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            for (let i = 0; i < take; i++) {
              const q = buf.readInt8(p + i);
              out[o++] = d * q;
            }
            p += 32;
            break;
          }
          case 'Q8_K': {
            // Layout: d (F32), qs[QK_K] (int8), bsums[QK_K/16] (int16)
            const d = new DataView(buf.buffer, buf.byteOffset + p, 4).getFloat32(0, true); p += 4;
            for (let i = 0; i < take; i++) {
              const q = buf.readInt8(p + i);
              out[o++] = d * q;
            }
            // skip remainder of weights in this block and the bsums
            p += 256;
            p += 32; // 16 int16 block sums
            break;
          }
          case 'Q2_K': {
            // Layout: scales[16], qs[64], d(f16), dmin(f16)
            const scalesOff = p; p += 16;
            const qsOff = p; p += 64;
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const dmin = halfToFloat(buf.readUInt16LE(p)); p += 2;
            // precompute per-group scale/offset for 16 groups of 16
            const dl = new Float32Array(16);
            const ml = new Float32Array(16);
            for (let g = 0; g < 16; g++) {
              const sc = buf.readUInt8(scalesOff + g);
              dl[g] = d * (sc & 0x0F);
              ml[g] = dmin * (sc >> 4);
            }
            let written = 0;
            for (let j = 0; j < 256 && written < take; j++) {
              const byte = buf.readUInt8(qsOff + (j >> 2));
              const val = (byte >> ((j & 3) * 2)) & 0x03; // 2-bit
              const g = (j >> 4); // group of 16
              out[o++] = dl[g] * val - ml[g];
              written++;
            }
            break;
          }
          case 'Q3_K': {
            // Layout: hmask[32], qs[64], scales[12], d(f16)
            const hmaskOff = p; p += 32;
            const qsOff = p; p += 64;
            const scalesOff = p; p += 12;
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            // Unpack 16 6-bit scales from 12 bytes (pattern in gguf/quants.py)
            const low4 = new Uint8Array(16);
            for (let i = 0; i < 8; i++) {
              const b0 = buf.readUInt8(scalesOff + i);
              low4[2 * i + 0] = b0 & 0x0F;
              low4[2 * i + 1] = (b0 >> 4) & 0x0F;
            }
            const high2 = new Uint8Array(16);
            for (let i = 0; i < 4; i++) {
              const b0 = buf.readUInt8(scalesOff + 8 + i);
              high2[4 * i + 0] = (b0 >> 0) & 0x03;
              high2[4 * i + 1] = (b0 >> 2) & 0x03;
              high2[4 * i + 2] = (b0 >> 4) & 0x03;
              high2[4 * i + 3] = (b0 >> 6) & 0x03;
            }
            const dl = new Float32Array(16);
            for (let i = 0; i < 16; i++) {
              const sc6 = ((high2[i] << 4) | low4[i]) & 0x3F;
              const sc = (sc6 << 26) >> 26; // sign-extend 6-bit to int32
              dl[i] = d * sc;
            }
            let written = 0;
            for (let j = 0; j < 256 && written < take; j++) {
              const qlByte = buf.readUInt8(qsOff + (j >> 2));
              const ql = (qlByte >> ((j & 3) * 2)) & 0x03; // 2-bit low
              const hmByte = buf.readUInt8(hmaskOff + (j >> 3));
              const qhBit = (hmByte >> (j & 7)) & 0x01;
              const qh = qhBit ^ 0x01; // invert as per reference
              const q = (ql - (qh << 2)); // int8
              const g = (j >> 4);
              out[o++] = dl[g] * q;
              written++;
            }
            break;
          }
          case 'Q4_K': {
            // Layout: d(f16), dmin(f16), scales[12], qs[128]
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const dmin = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const scalesOff = p; p += 12;
            const qsOff = p; p += 128;
            // Unpack sc[8], m[8] from 12 bytes as in quants.py
            const dBytes0 = buf.readUInt8(scalesOff + 0);
            const dBytes1 = buf.readUInt8(scalesOff + 1);
            const dBytes2 = buf.readUInt8(scalesOff + 2);
            const dBytes3 = buf.readUInt8(scalesOff + 3);
            const mBytes0 = buf.readUInt8(scalesOff + 4);
            const mBytes1 = buf.readUInt8(scalesOff + 5);
            const mBytes2 = buf.readUInt8(scalesOff + 6);
            const mBytes3 = buf.readUInt8(scalesOff + 7);
            const mdBytes0 = buf.readUInt8(scalesOff + 8);
            const mdBytes1 = buf.readUInt8(scalesOff + 9);
            const mdBytes2 = buf.readUInt8(scalesOff + 10);
            const mdBytes3 = buf.readUInt8(scalesOff + 11);
            const scArr = new Uint8Array(8);
            const mArr = new Uint8Array(8);
            // low 4 for sc: d & 0x3F, min: m & 0x3F
            scArr[0] = dBytes0 & 0x3F; scArr[1] = dBytes1 & 0x3F; scArr[2] = dBytes2 & 0x3F; scArr[3] = dBytes3 & 0x3F;
            mArr[0] = mBytes0 & 0x3F; mArr[1] = mBytes1 & 0x3F; mArr[2] = mBytes2 & 0x3F; mArr[3] = mBytes3 & 0x3F;
            // high 2 bits packed
            scArr[4] = (mdBytes0 & 0x0F) | ((dBytes0 >> 2) & 0x30);
            scArr[5] = (mdBytes1 & 0x0F) | ((dBytes1 >> 2) & 0x30);
            scArr[6] = (mdBytes2 & 0x0F) | ((dBytes2 >> 2) & 0x30);
            scArr[7] = (mdBytes3 & 0x0F) | ((dBytes3 >> 2) & 0x30);
            mArr[4] = (mdBytes0 >> 4) | ((mBytes0 >> 2) & 0x30);
            mArr[5] = (mdBytes1 >> 4) | ((mBytes1 >> 2) & 0x30);
            mArr[6] = (mdBytes2 >> 4) | ((mBytes2 >> 2) & 0x30);
            mArr[7] = (mdBytes3 >> 4) | ((mBytes3 >> 2) & 0x30);
            // per-group scales
            const dSc = new Float32Array(8);
            const dMin = new Float32Array(8);
            for (let g = 0; g < 8; g++) { dSc[g] = d * scArr[g]; dMin[g] = dmin * mArr[g]; }
            let written = 0;
            // 8 groups, each group has 16 bytes -> 32 nibbles
            for (let g = 0; g < 8 && written < take; g++) {
              const base = qsOff + g * 16;
              for (let j = 0; j < 32 && written < take; j++) {
                const bIdx = base + (j >> 1);
                const byte = buf.readUInt8(bIdx);
                const ql = (j & 1) === 0 ? (byte & 0x0F) : (byte >> 4);
                out[o++] = dSc[g] * ql - dMin[g];
                written++;
              }
            }
            break;
          }
          case 'Q5_K': {
            // Layout: d(f16), dmin(f16), scales[12], qh[32], qs[128]
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const dmin = halfToFloat(buf.readUInt16LE(p)); p += 2;
            const scalesOff = p; p += 12;
            const qhOff = p; p += 32;
            const qsOff = p; p += 128;
            // unpack scales/min like Q4_K
            const d0 = buf.readUInt8(scalesOff + 0), d1 = buf.readUInt8(scalesOff + 1), d2 = buf.readUInt8(scalesOff + 2), d3 = buf.readUInt8(scalesOff + 3);
            const m0 = buf.readUInt8(scalesOff + 4), m1 = buf.readUInt8(scalesOff + 5), m2 = buf.readUInt8(scalesOff + 6), m3 = buf.readUInt8(scalesOff + 7);
            const md0 = buf.readUInt8(scalesOff + 8), md1 = buf.readUInt8(scalesOff + 9), md2 = buf.readUInt8(scalesOff + 10), md3 = buf.readUInt8(scalesOff + 11);
            const scArr = new Uint8Array(8);
            const mArr = new Uint8Array(8);
            scArr[0] = d0 & 0x3F; scArr[1] = d1 & 0x3F; scArr[2] = d2 & 0x3F; scArr[3] = d3 & 0x3F;
            mArr[0] = m0 & 0x3F; mArr[1] = m1 & 0x3F; mArr[2] = m2 & 0x3F; mArr[3] = m3 & 0x3F;
            scArr[4] = (md0 & 0x0F) | ((d0 >> 2) & 0x30);
            scArr[5] = (md1 & 0x0F) | ((d1 >> 2) & 0x30);
            scArr[6] = (md2 & 0x0F) | ((d2 >> 2) & 0x30);
            scArr[7] = (md3 & 0x0F) | ((d3 >> 2) & 0x30);
            mArr[4] = (md0 >> 4) | ((m0 >> 2) & 0x30);
            mArr[5] = (md1 >> 4) | ((m1 >> 2) & 0x30);
            mArr[6] = (md2 >> 4) | ((m2 >> 2) & 0x30);
            mArr[7] = (md3 >> 4) | ((m3 >> 2) & 0x30);
            const dSc = new Float32Array(8);
            const dMin = new Float32Array(8);
            for (let g = 0; g < 8; g++) { dSc[g] = d * scArr[g]; dMin[g] = dmin * mArr[g]; }
            let written = 0;
            for (let g = 0; g < 8 && written < take; g++) {
              const baseQh = qhOff + g * 4; // 32 values -> 4 bytes of bits
              const baseQs = qsOff + g * 16; // 32 nibbles -> 16 bytes
              for (let j = 0; j < 32 && written < take; j++) {
                const qlByte = buf.readUInt8(baseQs + (j >> 1));
                const lo = (j & 1) === 0 ? (qlByte & 0x0F) : (qlByte >> 4);
                const hb = buf.readUInt8(baseQh + (j >> 3));
                const hi = (hb >> (j & 7)) & 0x01;
                const q = lo | (hi << 4);
                out[o++] = dSc[g] * q - dMin[g];
                written++;
              }
            }
            break;
          }
          case 'Q6_K': {
            // Layout: ql[128], qh[64], scales[16], d(f16)
            const qlOff = p; p += 128;
            const qhOff = p; p += 64;
            const scalesOff = p; p += 16;
            const d = halfToFloat(buf.readUInt16LE(p)); p += 2;
            // scales are int8 per 16-group
            const dSc = new Float32Array(16);
            for (let g = 0; g < 16; g++) {
              const s = (buf.readInt8(scalesOff + g) | 0);
              dSc[g] = d * s;
            }
            let written = 0;
            for (let j = 0; j < 256 && written < take; j++) {
              // low 4 bits from ql
              const bL = buf.readUInt8(qlOff + (j >> 1));
              const lo = (j & 1) === 0 ? (bL & 0x0F) : (bL >> 4);
              // high 2 bits from qh
              const bH = buf.readUInt8(qhOff + (j >> 2));
              const hi2 = (bH >> ((j & 3) * 2)) & 0x03;
              const q = ((lo | (hi2 << 4)) - 32);
              const g = (j >> 4);
              out[o++] = dSc[g] * q;
              written++;
            }
            break;
          }
          default:
            throw new Error(`Unsupported quant type: ${qi.type}`);
        }
        remaining -= take;
      }
    }
    return out;
  }

  const out = new Map<string, mx.array>();
  const include = opts?.include ?? (() => true);
  // Embedding and output (optional via include)
  const tokEmb = findAny(['tok_embeddings.weight', 'token_embd.weight', 'embeddings.weight']);
  const outHead = findAny(['output.weight', 'output_norm.weight', 'lm_head.weight']);
  const needTok = include('text_emb.weight');
  const needOut = include('text_out_head.weight');
  if ((needTok && !tokEmb) || (needOut && !outHead)) throw new Error('GGUF: missing embeddings/output');
  if (!n_vocab && tokEmb) {
    const [a, b] = tokEmb.dims;
    n_vocab = Math.max(a, b);
  }
  if (needTok && tokEmb) {
    opts?.progress?.('text_emb.weight');
    out.set('text_emb.weight', await toMx(tokEmb));
  }
  if (needOut && outHead) {
    opts?.progress?.('text_out_head.weight');
    out.set('text_out_head.weight', await toMx(outHead));
  }

  const limit = Math.min(n_layer, Math.max(0, opts?.maxLayers ?? n_layer));
  for (let i = 0; i < limit; i++) {
    const base = `layers.${i}`;
    const alt = `blk.${i}`;
    const attn_q = findAny([`${base}.attention.wq.weight`, `${alt}.attn_q.weight`]);
    const attn_k = findAny([`${base}.attention.wk.weight`, `${alt}.attn_k.weight`]);
    const attn_v = findAny([`${base}.attention.wv.weight`, `${alt}.attn_v.weight`]);
    const attn_o = findAny([`${base}.attention.wo.weight`, `${alt}.attn_output.weight`, `${alt}.attn_o.weight`]);
    const attn_norm = findAny([`${base}.attention_norm.weight`, `${alt}.attn_norm.weight`, `${base}.input_layernorm.weight`]);
    const ffn_norm = findAny([`${base}.ffn_norm.weight`, `${alt}.ffn_norm.weight`, `${base}.post_attention_layernorm.weight`]);
    const ffn_w1 = findAny([`${base}.feed_forward.w1.weight`, `${alt}.ffn_gate.weight`, `${base}.ffn.w1.weight`]);
    const ffn_w2 = findAny([`${base}.feed_forward.w2.weight`, `${alt}.ffn_down.weight`, `${base}.ffn.w2.weight`]);
    const ffn_w3 = findAny([`${base}.feed_forward.w3.weight`, `${alt}.ffn_up.weight`, `${base}.ffn.w3.weight`]);

    if (!attn_q || !attn_k || !attn_v || !attn_o || !ffn_w1 || !ffn_w2 || !ffn_w3) {
      throw new Error(`GGUF: missing core layer weights at layer ${i}`);
    }

    if (include(`transformer.${i}.self_attn.q_proj`)) { opts?.progress?.(`transformer.${i}.self_attn.q_proj`); out.set(`transformer.${i}.self_attn.q_proj`, await toMx(attn_q)); }
    if (include(`transformer.${i}.self_attn.k_proj`)) { opts?.progress?.(`transformer.${i}.self_attn.k_proj`); out.set(`transformer.${i}.self_attn.k_proj`, await toMx(attn_k)); }
    if (include(`transformer.${i}.self_attn.v_proj`)) { opts?.progress?.(`transformer.${i}.self_attn.v_proj`); out.set(`transformer.${i}.self_attn.v_proj`, await toMx(attn_v)); }
    if (include(`transformer.${i}.self_attn.o_proj`)) { opts?.progress?.(`transformer.${i}.self_attn.o_proj`); out.set(`transformer.${i}.self_attn.o_proj`, await toMx(attn_o)); }
    if (include(`transformer.${i}.mlp.w1`)) { opts?.progress?.(`transformer.${i}.mlp.w1`); out.set(`transformer.${i}.mlp.w1`, await toMx(ffn_w1)); }
    if (include(`transformer.${i}.mlp.w2`)) { opts?.progress?.(`transformer.${i}.mlp.w2`); out.set(`transformer.${i}.mlp.w2`, await toMx(ffn_w2)); }
    if (include(`transformer.${i}.mlp.w3`)) { opts?.progress?.(`transformer.${i}.mlp.w3`); out.set(`transformer.${i}.mlp.w3`, await toMx(ffn_w3)); }
    if (attn_norm && include(`transformer.${i}.norm1.weight`)) { opts?.progress?.(`transformer.${i}.norm1.weight`); out.set(`transformer.${i}.norm1.weight`, await toMx(attn_norm)); }
    if (ffn_norm && include(`transformer.${i}.norm2.weight`)) { opts?.progress?.(`transformer.${i}.norm2.weight`); out.set(`transformer.${i}.norm2.weight`, await toMx(ffn_norm)); }
  }

  return { weights: out, meta: { n_layer: limit, n_head, d_model, n_vocab, n_kv_head, context_length, ff_length, rope_base, rope_scaling: null } };
}

export function createTextOnlyLmConfigFromGGUF(meta: {
  n_layer: number; n_head: number; d_model: number; n_vocab: number;
  n_kv_head?: number;
  context_length?: number;
  ff_length?: number;
  rope_base?: number;
  rope_scaling?: { type: 'linear' | 'yarn' | 'dynamic'; factor?: number } | null;
}) {
  const kvRepeat = meta.n_kv_head && meta.n_kv_head > 0 ? Math.max(1, Math.floor(meta.n_head / meta.n_kv_head)) : 1;
  const context = meta.context_length ?? 2048;
  const dimFF = meta.ff_length ?? 4 * meta.d_model;
  const maxPeriod = meta.rope_base ?? 10000;

  const transformer = {
    d_model: meta.d_model,
    num_heads: meta.n_head,
    num_layers: meta.n_layer,
    dim_feedforward: dimFF,
    causal: true,
    norm_first: true,
    bias_ff: false,
    bias_attn: false,
    layer_scale: null,
    context,
    max_period: maxPeriod,
    use_conv_block: false,
    use_conv_bias: true,
    cross_attention: false,
    gating: true,
    norm: 'rms_norm',
    positional_embedding: 'rope',
    conv_layout: false,
    conv_kernel_size: 3,
    kv_repeat: kvRepeat,
    max_seq_len: Math.max(4096, context),
    // NOTE: rope_scaling meta is parsed but not yet consumed by the TS transformer implementation.
  } as const;

  return {
    transformer,
    depformer: { transformer: { ...transformer, num_layers: 0 }, num_slices: 0, weights_per_step_schedule: null, low_rank_embeddings: null },
    text_in_vocab_size: meta.n_vocab,
    text_out_vocab_size: meta.n_vocab,
    audio_vocab_size: 0,
    audio_delays: [],
    audio_codebooks: 0,
    demux_second_stream: false,
    conditioners: {},
    extra_heads_dim: 0,
    extra_heads_num_heads: 0,
  };
}
