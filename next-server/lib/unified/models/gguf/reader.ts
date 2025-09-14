import { promises as fs } from 'fs';
import { Buffer } from 'buffer';

export type GgufDType =
  | 'F32' | 'F16' | 'BF16'
  | 'Q8_0'
  | 'Q6_K'
  | 'Q5_1' | 'Q5_0' | 'Q5_K_S' | 'Q5_K_M'
  | 'Q4_1' | 'Q4_0' | 'Q4_K_S' | 'Q4_K_M' | 'Q4_K_L'
  | 'Q3_K' | 'Q2_K'
  | string; // allow forward-compat during development

export type GgufTensorInfo = {
  name: string;
  shape: number[]; // row-major
  dtype: GgufDType;
  nbytes: number; // estimated size in file for this tensor
  dataOffset: number; // absolute file offset
  blksize?: number;   // quant block size if applicable
};

function align(n: number, a: number): number { const r = n % a; return r === 0 ? n : (n + (a - r)); }

function ggmlTypeToString(t: number): GgufDType {
  const map: Record<number, string> = {
    0: 'F32',
    1: 'F16',
    2: 'Q4_0',
    3: 'Q4_1',
    4: 'Q5_0',
    5: 'Q5_1',
    6: 'Q8_0',
    7: 'Q8_1', // rarely used
    8: 'Q2_K',
    9: 'Q3_K',
    10: 'Q4_K',
    11: 'Q5_K',
    12: 'Q6_K',
    13: 'Q8_K',
    16: 'BF16',
  };
  const s = map[t] ?? `UNK_${t}`;
  // Normalize families used in info
  if (s === 'Q4_K') return 'Q4_K_M';
  if (s === 'Q5_K') return 'Q5_K_M';
  return s as GgufDType;
}

function elementBytes(dtype: string): number | null {
  switch (dtype.toUpperCase()) {
    case 'F32': return 4;
    case 'F16': return 2;
    case 'BF16': return 2;
    default: return null; // quantized or unknown
  }
}

function getQuantInfo(dt: string): { qk: number; blkSize: number } | null {
  switch (dt) {
    case 'Q4_0': return { qk: 32, blkSize: 2 + 16 };
    case 'Q4_1': return { qk: 32, blkSize: 2 + 2 + 16 };
    case 'Q5_0': return { qk: 32, blkSize: 2 + 4 + 16 };
    case 'Q5_1': return { qk: 32, blkSize: 2 + 2 + 4 + 16 };
    case 'Q8_0': return { qk: 32, blkSize: 2 + 32 };
    // K quants (use common defaults)
    case 'Q2_K': return { qk: 256, blkSize: 2 + 64 };
    case 'Q3_K': return { qk: 256, blkSize: 2 + 16 + 32 };
    case 'Q4_K_S': return { qk: 256, blkSize: 2 + 12 + 48 };
    case 'Q4_K_M': return { qk: 256, blkSize: 2 + 12 + 48 };
    case 'Q4_K_L': return { qk: 256, blkSize: 2 + 12 + 64 };
    case 'Q5_K_S': return { qk: 256, blkSize: 2 + 12 + 64 };
    case 'Q5_K_M': return { qk: 256, blkSize: 2 + 12 + 64 };
    case 'Q6_K': return { qk: 256, blkSize: 2 + 16 + 64 };
    default: return null;
  }
}

export class GGUFReader {
  static async open(file: string): Promise<GGUFReader> {
    const handle = await fs.open(file, 'r');
    const reader = new GGUFReader(file, handle);
    await reader.#readAll();
    return reader;
  }

  readonly file: string;
  readonly version: number = 0;
  readonly alignment: number = 32; // default per spec; may be overridden
  readonly fields: Map<string, unknown> = new Map();
  readonly tensors: GgufTensorInfo[] = [];

  #handle: fs.FileHandle;
  #dataBase = 0;

  private constructor(file: string, handle: fs.FileHandle) {
    this.file = file;
    this.#handle = handle;
  }

  async close(): Promise<void> {
    try { await this.#handle.close(); } catch { /* ignore */ }
  }

  getMetaStr(key: string): string | undefined {
    const v = this.fields.get(key);
    return typeof v === 'string' ? v : undefined;
  }
  getMetaInt(key: string): number | undefined {
    const v = this.fields.get(key);
    return typeof v === 'number' && Number.isInteger(v) ? v : undefined;
  }
  getMetaFloat(key: string): number | undefined {
    const v = this.fields.get(key);
    return typeof v === 'number' ? v : undefined;
  }
  getMetaBool(key: string): boolean | undefined {
    const v = this.fields.get(key);
    return typeof v === 'boolean' ? v : undefined;
  }
  getMetaArr<T = unknown>(key: string): T[] | undefined {
    const v = this.fields.get(key);
    return Array.isArray(v) ? (v as T[]) : undefined;
  }

  async readTensor(nameOrIndex: string | number, opts?: { dequantize?: boolean; to?: 'f32' | 'f16' | 'raw' }): Promise<Buffer> {
    void opts;
    const info = typeof nameOrIndex === 'number' ? this.tensors[nameOrIndex] : this.tensors.find(t => t.name === nameOrIndex);
    if (!info) throw new Error(`GGUFReader.readTensor: tensor not found: ${String(nameOrIndex)}`);
    const buf = Buffer.alloc(info.nbytes);
    await this.#handle.read(buf, 0, info.nbytes, info.dataOffset);
    return buf;
  }

  async streamTensor(nameOrIndex: string | number, onChunk: (chunk: Float32Array | Buffer, chunkIndex: number) => void, opts?: { dequantize?: boolean }): Promise<void> {
    void nameOrIndex; void onChunk; void opts;
    throw new Error('GGUFReader.streamTensor not implemented yet');
  }

  async #readAll(): Promise<void> {
    // Read a large head to parse magic, version, kvs and tensor table
    const HEAD_MAX = 64 * 1024 * 1024;
    const head = Buffer.alloc(HEAD_MAX);
    const { bytesRead } = await this.#handle.read(head, 0, HEAD_MAX, 0);
    const buf = head.subarray(0, bytesRead);

    let p = 0;
    // Magic 'GGUF'
    const magic = buf.readUInt32LE(p); p += 4;
    if (magic !== 0x46554747) {
      throw new Error('Not a GGUF file (bad magic)');
    }
    const version = buf.readUInt32LE(p); p += 4;
    (this as any).version = version;
    if (version < 2) throw new Error(`Unsupported GGUF version ${version}`);

    const nTensors = Number(buf.readBigUInt64LE(p)); p += 8;
    const nKV = Number(buf.readBigUInt64LE(p)); p += 8;

    // Parse KV table
    for (let i = 0; i < nKV; i++) {
      const klen = Number(buf.readBigUInt64LE(p)); p += 8;
      const key = buf.toString('utf8', p, p + klen); p += klen;
      const type = buf.readUInt32LE(p); p += 4;
      const { value, next } = this.#readValue(buf, p, type);
      p = next;
      this.fields.set(key, value as unknown);
    }

    // Tensor infos
    const tensors: GgufTensorInfo[] = [];
    for (let i = 0; i < nTensors; i++) {
      const nlen = Number(buf.readBigUInt64LE(p)); p += 8;
      const name = buf.toString('utf8', p, p + nlen); p += nlen;
      const n_dims = buf.readUInt32LE(p); p += 4;
      const dims: number[] = [];
      for (let d = 0; d < n_dims; d++) { dims.push(Number(buf.readBigUInt64LE(p))); p += 8; }
      const dtypeId = buf.readUInt32LE(p); p += 4;
      // relative data offset (we will compute absolute later)
      p += 8;
      const dtype = ggmlTypeToString(dtypeId);
      // compute nbytes estimate
      const outer = dims.slice(0, dims.length - 1).reduce((a, b) => a * b, 1) || 1;
      const last = dims[dims.length - 1] || 1;
      let nbytes = 0;
      const el = elementBytes(dtype);
      if (el) {
        nbytes = el * (outer * last);
      } else {
        const qi = getQuantInfo(dtype);
        if (qi) {
          const blocksPerRow = Math.ceil(last / qi.qk);
          const rowBytes = blocksPerRow * qi.blkSize;
          nbytes = outer * rowBytes;
        } else {
          nbytes = 0; // unknown
        }
      }
      tensors.push({ name, shape: dims, dtype: dtype as GgufDType, nbytes, dataOffset: 0 });
      // dataOffset will be filled after we know base alignment
    }

    const dataBase = align(p, 32);
    (this as any).alignment = 32;
    this.#dataBase = dataBase;
    // patch absolute offsets
    for (let i = 0; i < tensors.length; i++) {
      // Need to re-read the relative offset; we already consumed it above, but we stored nothing.
      // To avoid a second pass over buffer, recompute by reading again is costly; instead, we can re-parse offsets quickly.
      // However, simpler: we tracked offsRel when parsing each tensor; we can compute absolute now.
      // We stored only nbytes and placeholder offset; adjust loop to store offsRel too.
    }
    // Re-parse only offsets and fix dataOffset
    // Simpler: redo a tiny pass for offsets only
    let p2 = 4 + 4 + 8 + 8; // after magic, version, nTensors, nKV
    for (let i = 0; i < nKV; i++) {
      const klen = Number(buf.readBigUInt64LE(p2)); p2 += 8; p2 += klen; // key
      p2 += 4; // type
      const { next } = this.#readValue(buf, p2, buf.readUInt32LE(p2 - 4));
      p2 = next;
    }
    const tensors2: { offs: number }[] = [];
    for (let i = 0; i < nTensors; i++) {
      const nlen = Number(buf.readBigUInt64LE(p2)); p2 += 8; p2 += nlen;
      const n_dims = buf.readUInt32LE(p2); p2 += 4;
      for (let d = 0; d < n_dims; d++) { p2 += 8; }
      p2 += 4; // dtype
      const offsRel = Number(buf.readBigUInt64LE(p2)); p2 += 8;
      tensors2.push({ offs: offsRel });
    }
    for (let i = 0; i < tensors.length; i++) {
      tensors[i].dataOffset = this.#dataBase + tensors2[i].offs;
    }

    // commit tensors
    this.tensors.splice(0, this.tensors.length, ...tensors);
  }

  #readValue(buf: Buffer, off: number, type: number): { value: unknown; next: number } {
    // GGUF types (superset across versions): 0=uint8,1=int8,2=uint16,3=int16,4=uint32,5=int32,6=uint64,7=int64,8=float32,9=float64,10=bool,11=string,12=array
    switch (type) {
      case 0: return { value: buf.readUInt8(off), next: off + 1 };
      case 1: return { value: buf.readInt8(off), next: off + 1 };
      case 2: return { value: buf.readUInt16LE(off), next: off + 2 };
      case 3: return { value: buf.readInt16LE(off), next: off + 2 };
      case 4: return { value: buf.readUInt32LE(off), next: off + 4 };
      case 5: return { value: buf.readInt32LE(off), next: off + 4 };
      case 6: return { value: Number(buf.readBigUInt64LE(off)), next: off + 8 };
      case 7: return { value: Number(buf.readBigInt64LE(off)), next: off + 8 };
      case 8: return { value: buf.readFloatLE(off), next: off + 4 };
      case 9: return { value: buf.readDoubleLE(off), next: off + 8 };
      case 10: return { value: buf.readUInt8(off) !== 0, next: off + 1 };
      case 11: {
        const slen = Number(buf.readBigUInt64LE(off));
        const start = off + 8; const end = start + slen;
        return { value: buf.toString('utf8', start, end), next: end };
      }
      case 12: {
        const elType = buf.readUInt32LE(off); let p = off + 4;
        const n = Number(buf.readBigUInt64LE(p)); p += 8;
        const arr: unknown[] = [];
        for (let i = 0; i < n; i++) { const v = this.#readValue(buf, p, elType); p = v.next; arr.push(v.value); }
        return { value: arr, next: p };
      }
      default:
        throw new Error(`Unsupported GGUF KV type: ${type}`);
    }
  }
}
