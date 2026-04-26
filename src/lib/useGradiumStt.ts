import { useRef, useState, useCallback } from 'react';

export type SttState = 'idle' | 'connecting' | 'recording' | 'processing' | 'error';

const SAMPLE_RATE = 24000;
const CHUNK_SAMPLES = 2048; // Gradium's recommended chunk size

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

  const start = useCallback(async () => {
    teardown();
    setState('connecting');
    accRef.current = '';
    setTranscript('');
    console.log('[stt] Starting STT connection...');

    // AudioContext MUST be created synchronously here, before any await,
    // while we're still inside the button-click user gesture.
    // Chrome suspends AudioContext created outside a user gesture, which
    // silently prevents onaudioprocess from ever firing.
    let audioCtx: AudioContext;
    try {
      audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;
      console.log('[stt] AudioContext created, sampleRate:', SAMPLE_RATE);
    } catch (e) {
      console.error('[stt] Failed to create AudioContext:', e);
      setState('error');
      return;
    }

    let stream: MediaStream;
    try {
      console.log('[stt] Requesting microphone access...');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[stt] Microphone access granted, tracks:', stream.getTracks().length);
    } catch (e) {
      console.error('[stt] Failed to get microphone:', e);
      setState('error');
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      return;
    }
    streamRef.current = stream;

    const wsUrl = `ws://${location.host}/api/gradium/stt`;
    console.log('[stt] Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[stt] WebSocket connected, sending setup...');
      ws.send(JSON.stringify({ type: 'setup', model_name: 'default', input_format: 'pcm'}));
    };

    ws.onmessage = (e) => {
      console.log('[stt] message from server:', e.data);
      if (typeof e.data !== 'string') return;
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(e.data); } catch { return; }

      console.log('[stt] parsed message type:', msg.type, 'keys:', Object.keys(msg));

      if (msg.type === 'ready') {
        console.log('[stt] Server ready, starting audio capture');
        setState('recording');
        const ctx = audioCtxRef.current;
        if (!ctx) { setState('error'); teardown(); return; }

        // Resume in case browser auto-suspended it (e.g. tab was inactive)
        void ctx.resume().then(() => {
          const source = ctx.createMediaStreamSource(stream);
          const processor = ctx.createScriptProcessor(CHUNK_SAMPLES, 1, 1);
          processorRef.current = processor;

          // ScriptProcessorNode must be connected to output to fire — use a
          // silent gain node so we don't echo the mic back to the speakers
          const silencer = ctx.createGain();
          silencer.gain.value = 0;

          let chunkCount = 0;
          processor.onaudioprocess = (ev) => {
            console.log('[stt] onaudioprocess fired, ws state:', ws.readyState, 'chunks so far:', chunkCount);
            if (ws.readyState !== WebSocket.OPEN) return;
            const float32 = ev.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
              int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
            }
            
            // Gradium expects base64-encoded JSON, not raw binary
            // Format: {"type": "audio", "audio": "<base64-encoded int16 PCM>"}
            // Use a more robust base64 encoding that handles large arrays
            const bytes = new Uint8Array(int16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = btoa(binary);
            
            ws.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
            
            chunkCount++;
            console.log('[stt] sent chunk', chunkCount, '— bytes:', int16.byteLength, 'base64 length:', base64Audio.length);
          };

          source.connect(processor);
          processor.connect(silencer);
          silencer.connect(ctx.destination);
        });

      } else if (msg.type === 'text') {
        // Each text message is a transcribed segment — accumulate for realtime display
        console.log('[stt] Received text:', msg.text);
        const newText = (msg.text as string) ?? '';
        
        // Add space between segments if needed (but avoid double spaces)
        if (accRef.current.length > 0 && newText.length > 0) {
          const lastChar = accRef.current.slice(-1);
          const firstChar = newText[0];
          // Add space if last char isn't whitespace/punctuation and first char isn't whitespace
          if (!/\s/.test(lastChar) && !/\s/.test(firstChar)) {
            accRef.current += ' ';
          }
        }
        accRef.current += newText;
        setTranscript(accRef.current);

      } else if (msg.type === 'step') {
        // VAD information - can be used for visual feedback
        console.log('[stt] VAD step:', msg);

      } else if (msg.type === 'flushed') {
        // Server confirmed all buffered audio has been processed
        console.log('[stt] Flushed, final transcript:', accRef.current);
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        setState('idle');
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        wsRef.current = null;
        ws.close();

      } else if (msg.type === 'error') {
        console.error('[stt] Server error:', msg);
        setState('error');
        teardown();
      } else {
        console.log('[stt] Unknown message type:', msg.type, msg);
      }
    };

    ws.onerror = (e) => { console.error('[stt] WebSocket error:', e); setState('error'); teardown(); };
    ws.onclose = (e) => { console.log('[stt] WebSocket closed — code:', e.code, 'reason:', e.reason, 'clean:', e.wasClean); stream.getTracks().forEach(t => t.stop()); };
  }, [teardown]);

  const stop = useCallback(() => {
    setState('processing');
    // Stop audio capture but keep WebSocket open to receive flushed response
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Gradium expects end_of_stream after all audio is sent
      wsRef.current.send(JSON.stringify({ type: 'end_of_stream' }));
    }
    // Fallback: go idle if server doesn't reply within 10s
    timeoutRef.current = setTimeout(() => {
      teardown();
      setState('idle');
    }, 10000);
  }, [teardown]);

  const cancel = useCallback(() => {
    teardown();
    setState('idle');
  }, [teardown]);

  const toggle = useCallback(() => {
    if (state === 'idle' || state === 'error') void start();
    else if (state === 'recording') stop();
    else if (state === 'processing') cancel();
  }, [state, start, stop, cancel]);

  return { state, transcript, toggle };
}
