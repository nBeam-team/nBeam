/**
 * Gradium Speech-to-Text React Hook
 *
 * Captures microphone audio, streams PCM data over WebSocket to the
 * `/api/gradium/stt` proxy, and accumulates the transcript in real-time.
 *
 * Usage:
 *   const { state, transcript, toggle } = useGradiumStt();
 *   // state: 'idle' | 'connecting' | 'recording' | 'processing' | 'error'
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type SttState = 'idle' | 'connecting' | 'recording' | 'processing' | 'error';

const SAMPLE_RATE = 24000;
const CHUNK_SAMPLES = 2048;

export function useGradiumStt() {
  const [state, setState] = useState<SttState>('idle');
  const [transcript, setTranscript] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accRef = useRef('');

  const teardown = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Keep teardown ref stable for cleanup
  const teardownRef = useRef(teardown);
  useLayoutEffect(() => { teardownRef.current = teardown; });

  const start = useCallback(async () => {
    teardownRef.current();
    setState('connecting');
    accRef.current = '';
    setTranscript('');

    // AudioContext MUST be created synchronously inside the user gesture
    // to prevent Chrome from auto-suspending it.
    let audioCtx: AudioContext;
    try {
      audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;
    } catch {
      setState('error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('error');
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      return;
    }
    streamRef.current = stream;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/api/gradium/stt`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'setup', model_name: 'default', input_format: 'pcm' }));
    };

    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === 'ready') {
        setState('recording');
        const ctx = audioCtxRef.current;
        if (!ctx) { setState('error'); teardownRef.current(); return; }

        void ctx.resume().then(() => {
          const source = ctx.createMediaStreamSource(stream);
          const processor = ctx.createScriptProcessor(CHUNK_SAMPLES, 1, 1);
          processorRef.current = processor;

          const silencer = ctx.createGain();
          silencer.gain.value = 0;

          processor.onaudioprocess = (ev) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const float32 = ev.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
              int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
            }
            const bytes = new Uint8Array(int16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            ws.send(JSON.stringify({ type: 'audio', audio: btoa(binary) }));
          };

          source.connect(processor);
          processor.connect(silencer);
          silencer.connect(ctx.destination);
        });

      } else if (msg.type === 'text') {
        const newText = (msg.text as string) ?? '';
        if (accRef.current.length > 0 && newText.length > 0) {
          const lastChar = accRef.current.slice(-1);
          const firstChar = newText[0];
          if (!/\s/.test(lastChar) && !/\s/.test(firstChar)) {
            accRef.current += ' ';
          }
        }
        accRef.current += newText;
        setTranscript(accRef.current);

      } else if (msg.type === 'flushed') {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        setState('idle');
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        wsRef.current = null;
        ws.close();

      } else if (msg.type === 'error') {
        console.error('[stt] Server error:', msg);
        setState('error');
        teardownRef.current();
      }
    };

    ws.onerror = () => { setState('error'); teardownRef.current(); };
    ws.onclose = () => { stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const stop = useCallback(() => {
    setState('processing');
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_of_stream' }));
    }
    // Fallback: go idle if server doesn't reply within 10s
    timeoutRef.current = setTimeout(() => {
      teardownRef.current();
      setState('idle');
    }, 10_000);
  }, []);

  const cancel = useCallback(() => {
    teardownRef.current();
    setState('idle');
  }, []);

  const toggle = useCallback(() => {
    if (state === 'idle' || state === 'error') void start();
    else if (state === 'recording') stop();
    else if (state === 'processing') cancel();
  }, [state, start, stop, cancel]);

  return { state, transcript, toggle };
}
