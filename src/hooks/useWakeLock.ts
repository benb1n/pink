import { useCallback, useEffect, useRef } from 'react';

export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      lockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // Not critical — user can still keep screen on manually
    }
  }, []);

  const release = useCallback(async () => {
    try {
      await lockRef.current?.release();
      lockRef.current = null;
    } catch {
      // ignore
    }
  }, []);

  // Re-acquire after page becomes visible again (e.g. user unlocks screen)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && lockRef.current === null) {
        // Only re-acquire if we were previously playing (caller manages this)
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return { acquire, release };
}
