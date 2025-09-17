import React, { useRef, useState } from 'react';
import MoshiWSClient from '../lib/moshi-ws-client';

export function MoshiWsDemo(): JSX.Element {
  const clientRef = useRef<MoshiWSClient | null>(null);
  const [running, setRunning] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);

    const bufferSize = 4096; // script processor size
    const processor = audioCtxRef.current.createScriptProcessor(bufferSize, 1, 1);
    // Rolling buffer state
    const FRAME_SIZE = 1920;
    let rollBuffer = new Float32Array(0);

    processor.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0);
      // concat rollBuffer + input
      const newBuf = new Float32Array(rollBuffer.length + input.length);
      newBuf.set(rollBuffer, 0);
      newBuf.set(input, rollBuffer.length);

      let offset = 0;
      while (offset + FRAME_SIZE <= newBuf.length) {
        const frame = new Float32Array(FRAME_SIZE);
        frame.set(newBuf.subarray(offset, offset + FRAME_SIZE));
        // send frame to server
        clientRef.current?.sendPCMFrame(frame);
        offset += FRAME_SIZE;
      }

      // leftover
      const leftover = newBuf.length - offset;
      if (leftover > 0) {
        rollBuffer = new Float32Array(leftover);
        rollBuffer.set(newBuf.subarray(offset));
      } else {
        rollBuffer = new Float32Array(0);
      }
    };

    sourceRef.current.connect(processor);
    processor.connect(audioCtxRef.current.destination);
    processorRef.current = processor;

    clientRef.current = new MoshiWSClient({ url: 'ws://localhost:8788' });
    clientRef.current.connect();
    setRunning(true);
  }

  function stop() {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close();
    clientRef.current?.disconnect();
    setRunning(false);
  }

  return (
    <div className="p-4">
      <h3>Moshi WS Demo</h3>
      <p>Streams microphone frames (1920 samples @24kHz) to the local WS server.</p>
      {!running ? (
        <button onClick={start} className="btn">Start</button>
      ) : (
        <button onClick={stop} className="btn">Stop</button>
      )}
    </div>
  );
}

export default MoshiWsDemo;
