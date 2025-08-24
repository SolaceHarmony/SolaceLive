/**
 * WebSocket protocol implementation for Moshi server
 * Compatible with client-side protocol from the React app
 */

export enum MessageType {
  AUDIO = 1,
  TEXT = 2,
  METADATA = 3
}

export interface ServerInfo {
  text_temperature: number;
  text_topk: number;
  audio_temperature: number;
  audio_topk: number;
  pad_mult: number;
  repetition_penalty_context: number;
  repetition_penalty: number;
  lm_model_file: string;
  instance_name: string;
  build_info: {
    build_timestamp: string;
    build_date: string;
    git_branch: string;
    git_timestamp: string;
    git_date: string;
    git_hash: string;
    git_describe: string;
    runtime_version: string;
    platform: string;
  };
}

export function encodeMessage(type: MessageType, data: Uint8Array | string): Uint8Array {
  if (typeof data === 'string') {
    const textData = new TextEncoder().encode(data);
    const message = new Uint8Array(textData.length + 1);
    message[0] = type;
    message.set(textData, 1);
    return message;
  } else {
    const message = new Uint8Array(data.length + 1);
    message[0] = type;
    message.set(data, 1);
    return message;
  }
}

export function decodeMessage(data: Uint8Array): { type: MessageType; data: Uint8Array } {
  if (data.length === 0) {
    throw new Error('Empty message');
  }
  
  const type = data[0] as MessageType;
  const payload = data.slice(1);
  
  return { type, data: payload };
}

export function createServerInfoMessage(): Uint8Array {
  const serverInfo: ServerInfo = {
    text_temperature: 0.7,
    text_topk: 50,
    audio_temperature: 0.8,
    audio_topk: 40,
    pad_mult: 8,
    repetition_penalty_context: 64,
    repetition_penalty: 1.1,
    lm_model_file: 'moshi-server-typescript',
    instance_name: 'Moshi TypeScript Server',
    build_info: {
      build_timestamp: Date.now().toString(),
      build_date: new Date().toISOString(),
      git_branch: 'main',
      git_timestamp: Date.now().toString(),
      git_date: new Date().toISOString(),
      git_hash: 'typescript-implementation',
      git_describe: 'server-side-transformer-v0.1.0',
      runtime_version: process.version,
      platform: process.platform
    }
  };

  const serverInfoJson = JSON.stringify(serverInfo);
  return encodeMessage(MessageType.METADATA, serverInfoJson);
}