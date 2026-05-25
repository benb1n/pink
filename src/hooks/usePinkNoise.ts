import { useCallback, useEffect, useRef, useState } from 'react';
import { useWakeLock } from './useWakeLock';

type State = 'idle' | 'playing' | 'loading';

const FADE_DURATION = 0.4; // seconds

export function usePinkNoise() {
  const [state, setState] = useState<State>('idle');
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const workletReadyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const { acquire: acquireWakeLock, release: releaseWakeLock } = useWakeLock();

  // Resume AudioContext when page regains visibility (iOS suspends it)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isPlayingRef.current) {
        ctxRef.current?.resume().catch(() => {});
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [acquireWakeLock]);

  const ensureContext = useCallback(async (): Promise<AudioContext> => {
    if (!ctxRef.current) {
      // Use 44100 Hz — most natural for pink noise, well-supported on iOS
      ctxRef.current = new AudioContext({ sampleRate: 44100, latencyHint: 'playback' });
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.gain.value = 0;
      gainRef.current.connect(ctxRef.current.destination);
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  }, []);

  const ensureWorklet = useCallback(async (ctx: AudioContext): Promise<void> => {
    if (workletReadyRef.current) return;
    await ctx.audioWorklet.addModule('/pink-noise-processor.js');
    workletReadyRef.current = true;
  }, []);

  const play = useCallback(async () => {
    if (isPlayingRef.current) return;
    setState('loading');
    try {
      const ctx = await ensureContext();
      await ensureWorklet(ctx);

      if (!nodeRef.current) {
        nodeRef.current = new AudioWorkletNode(ctx, 'pink-noise-processor', {
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });
        nodeRef.current.connect(gainRef.current!);
      }

      const gain = gainRef.current!;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + FADE_DURATION);

      isPlayingRef.current = true;
      setState('playing');
      await acquireWakeLock();
    } catch (err) {
      console.error('Pink noise start error:', err);
      setState('idle');
    }
  }, [ensureContext, ensureWorklet, acquireWakeLock]);

  const stop = useCallback(() => {
    if (!isPlayingRef.current || !ctxRef.current || !gainRef.current) return;

    const ctx = ctxRef.current;
    const gain = gainRef.current;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + FADE_DURATION);

    isPlayingRef.current = false;
    setState('idle');
    releaseWakeLock();
  }, [releaseWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return { state, play, stop };
}
