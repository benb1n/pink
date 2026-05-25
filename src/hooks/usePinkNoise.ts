import { useCallback, useEffect, useRef, useState } from 'react';
import { useWakeLock } from './useWakeLock';

type State = 'idle' | 'playing' | 'loading';

const FADE_DURATION = 0.4; // seconds

/**
 * A 100 ms loop of silence (8-bit, 8 kHz, mono WAV) encoded as a data URI.
 *
 * iOS Safari suspends AudioContext when the screen locks UNLESS an
 * HTMLMediaElement is actively playing, which forces the audio session into
 * the "playback" category and keeps background audio alive.  Playing this
 * inaudible clip in a loop is the standard fix for Web Audio on iOS.
 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

export function usePinkNoise() {
  const [state, setState] = useState<State>('idle');
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const workletReadyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const { acquire: acquireWakeLock, release: releaseWakeLock } = useWakeLock();

  // Resume AudioContext when page regains visibility (belt-and-suspenders for iOS)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isPlayingRef.current) {
        ctxRef.current?.resume().catch(() => {});
        silentAudioRef.current?.play().catch(() => {});
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

      // Start the silent audio element — this forces iOS into the "playback"
      // audio session category so the AudioContext survives screen lock.
      if (!silentAudioRef.current) {
        silentAudioRef.current = new Audio(SILENT_WAV);
        silentAudioRef.current.loop = true;
      }
      await silentAudioRef.current.play();

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
    silentAudioRef.current?.pause();
    releaseWakeLock();
  }, [releaseWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      silentAudioRef.current?.pause();
      ctxRef.current?.close();
    };
  }, []);

  return { state, play, stop };
}
