import { useCallback, useEffect, useRef, useState } from "react";
import { useWakeLock } from "./useWakeLock";

type State = "idle" | "playing" | "loading";

const FADE_DURATION = 0.4;

export function usePinkNoise() {
  const [state, setState] = useState<State>("idle");
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workletReadyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const { acquire: acquireWakeLock, release: releaseWakeLock } = useWakeLock();

  // Stable refs so MediaSession handlers always call the latest version
  const stopRef = useRef<() => void>(() => {});
  const playRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Wire up lock-screen media controls once
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => playRef.current());
    navigator.mediaSession.setActionHandler("pause", () => stopRef.current());
    navigator.mediaSession.setActionHandler("stop", () => stopRef.current());
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
    };
  }, []);

  // Re-animate after screen unlock — belt-and-suspenders on top of the
  // HTMLMediaElement approach below
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && isPlayingRef.current) {
        ctxRef.current?.resume().catch(() => {});
        audioElRef.current?.play().catch(() => {});
        acquireWakeLock();
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [acquireWakeLock]);

  const ensureContext = useCallback(async (): Promise<AudioContext> => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext({
        sampleRate: 44100,
        latencyHint: "playback",
      });

      gainRef.current = ctxRef.current.createGain();
      gainRef.current.gain.value = 0;

      // Route AudioContext output → MediaStreamDestinationNode → <audio>.
      //
      // A bare AudioContext gets suspended when the iPad screen locks, even in
      // standalone PWA mode.  Routing through an HTMLAudioElement tells iOS this
      // page has active media playback, which keeps audio alive through the lock
      // screen and surfaces it in Control Center "Now Playing".
      const dest = ctxRef.current.createMediaStreamDestination();
      gainRef.current.connect(dest);

      const audio = new Audio();
      audio.srcObject = dest.stream;
      audioElRef.current = audio;
    }

    if (ctxRef.current.state === "suspended") {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const ensureWorklet = useCallback(async (ctx: AudioContext) => {
    if (workletReadyRef.current) return;
    await ctx.audioWorklet.addModule("/pink-noise-processor.js");
    workletReadyRef.current = true;
  }, []);

  const stop = useCallback(() => {
    if (!isPlayingRef.current || !ctxRef.current || !gainRef.current) return;

    const ctx = ctxRef.current;
    const gain = gainRef.current;
    const now = ctx.currentTime;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + FADE_DURATION);

    // Pause the audio element after the fade so the stream stays intact for
    // the next play() call
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(
      () => {
        audioElRef.current?.pause();
      },
      (FADE_DURATION + 0.05) * 1000,
    );

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }

    isPlayingRef.current = false;
    setState("idle");
    releaseWakeLock();
  }, [releaseWakeLock]);

  const play = useCallback(async () => {
    if (isPlayingRef.current) return;
    setState("loading");

    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    try {
      const ctx = await ensureContext();
      await ensureWorklet(ctx);

      if (!nodeRef.current) {
        nodeRef.current = new AudioWorkletNode(ctx, "pink-noise-processor", {
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

      // Must call .play() inside the user-gesture handler
      await audioElRef.current!.play();

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "Pink Noise",
          album: "Sleep Machine",
        });
        navigator.mediaSession.playbackState = "playing";
      }

      isPlayingRef.current = true;
      setState("playing");
      await acquireWakeLock();
    } catch (err) {
      console.error("Pink noise start error:", err);
      setState("idle");
    }
  }, [ensureContext, ensureWorklet, acquireWakeLock]);

  // Keep stable refs current
  stopRef.current = stop;
  playRef.current = play;

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      audioElRef.current?.pause();
      ctxRef.current?.close();
    };
  }, []);

  return { state, play, stop };
}
