/**
 * useWakeLock.ts
 *
 * React custom hook port of the vanilla wakeLock.js utility.
 * https://developer.mozilla.org/en-US/docs/Web/API/WakeLock
 *
 * The original file relied on several externally-defined globals:
 *   - myAudioStatus / myVideoStatus / myScreenStatus (call state flags)
 *   - isDesktopDevice
 *   - switchKeepAwake (a DOM checkbox element, mutated via .checked)
 *   - userLog(channel, message)
 *
 * In React these become hook inputs (props/state you pass in) and hook
 * outputs (state you bind to your own UI) instead of module-level
 * globals / direct DOM writes. All the actual decision logic —
 * `isAudioOrUIActive`, `shouldKeepAwake`, the request/release/debounced
 * sync flow, and all the event listeners — is preserved exactly.
 *
 * Usage in App.tsx:
 *
 *   const { keepAwakeActive, setKeepAwake, isSupported } = useWakeLock({
 *     isDesktopDevice,
 *     audioStatus: myAudioStatus,
 *     videoStatus: myVideoStatus,
 *     screenStatus: myScreenStatus,
 *     onLog: (message) => userLog("toast", message),
 *   });
 *
 *   // bind to your own checkbox instead of `switchKeepAwake.checked`:
 *   <input
 *     type="checkbox"
 *     checked={keepAwakeActive}
 *     onChange={(e) => setKeepAwake(e.target.checked)}
 *   />
 */

import { useCallback, useEffect, useRef, useState } from "react";

// The Screen Wake Lock API (navigator.wakeLock / WakeLockSentinel) is
// present in modern `lib.dom.d.ts`. This alias keeps the rest of the file
// readable and isolates us from lib version differences in one place.
type WakeLockSentinelLike = WakeLockSentinel;

export interface UseWakeLockOptions {
  /** Desktop devices never need a screen wake lock (mirrors `isDesktopDevice` global). */
  isDesktopDevice: boolean;
  /** Mirrors the `myAudioStatus` global. */
  audioStatus: boolean;
  /** Mirrors the `myVideoStatus` global. */
  videoStatus: boolean;
  /** Mirrors the `myScreenStatus` global. */
  screenStatus: boolean;
  /** Mirrors `userLog("toast", message)`. Called with the same messages as the original. */
  onLog?: (message: string) => void;
}

export interface UseWakeLockResult {
  /** Mirrors `switchKeepAwake.checked` — bind this to your own toggle UI. */
  keepAwakeActive: boolean;
  /** Mirrors `applyKeepAwake(enabled)`. */
  setKeepAwake: (enabled: boolean) => void;
  /** Mirrors `isWakeLockSupported()`. */
  isSupported: boolean;
}

export function useWakeLock(options: UseWakeLockOptions): UseWakeLockResult {
  const { isDesktopDevice, audioStatus, videoStatus, screenStatus, onLog } = options;

  const wakeLockSentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const userWantsKeepAwakeRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kept in refs so the async/event-listener callbacks below always read
  // the latest values (avoids stale closures), same effect as the
  // original code reading live module-level globals.
  const stateRef = useRef({ isDesktopDevice, audioStatus, videoStatus, screenStatus });
  useEffect(() => {
    stateRef.current = { isDesktopDevice, audioStatus, videoStatus, screenStatus };
  }, [isDesktopDevice, audioStatus, videoStatus, screenStatus]);

  const [keepAwakeActive, setKeepAwakeActive] = useState(false);

  const log = useCallback(
    (message: string) => {
      onLog?.(message);
    },
    [onLog],
  );

  const isWakeLockSupported = useCallback((): boolean => {
    return !!navigator?.wakeLock?.request;
  }, []);

  const isAudioOrUIActive = useCallback((): boolean => {
    const { audioStatus: a, videoStatus: v, screenStatus: s } = stateRef.current;
    return (a || userWantsKeepAwakeRef.current) && !v && !s;
  }, []);

  const shouldKeepAwake = useCallback((): boolean => {
    return (
      !stateRef.current.isDesktopDevice &&
      isWakeLockSupported() &&
      document.visibilityState === "visible" &&
      !document.pictureInPictureElement &&
      isAudioOrUIActive()
    );
  }, [isWakeLockSupported, isAudioOrUIActive]);

  const requestWakeLock = useCallback(async (): Promise<void> => {
    if (wakeLockSentinelRef.current || !shouldKeepAwake()) return;
    try {
      wakeLockSentinelRef.current = await navigator.wakeLock!.request("screen");
      wakeLockSentinelRef.current.addEventListener("release", () => {
        wakeLockSentinelRef.current = null;
        syncWakeLockDebounced();
      });
      setKeepAwakeActive(true);
      log("🟢 Wake Lock is active");
    } catch (err) {
      wakeLockSentinelRef.current = null;
      setKeepAwakeActive(false);
      const message = err instanceof Error ? err.message : String(err);
      log("🔴 Failed to request Wake Lock: " + message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldKeepAwake, log]);

  const releaseWakeLock = useCallback(async (): Promise<void> => {
    if (stateRef.current.isDesktopDevice) return;
    try {
      await wakeLockSentinelRef.current?.release();
      log("⚪ Wake Lock released");
    } catch {
      /* ignore */
    }
    wakeLockSentinelRef.current = null;
    setKeepAwakeActive(false);
  }, [log]);

  const syncWakeLock = useCallback(async (): Promise<void> => {
    shouldKeepAwake() ? await requestWakeLock() : await releaseWakeLock();
  }, [shouldKeepAwake, requestWakeLock, releaseWakeLock]);

  const syncWakeLockDebounced = useCallback((): void => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(syncWakeLock, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncWakeLock]);

  const setKeepAwake = useCallback(
    (enabled: boolean): void => {
      if (stateRef.current.isDesktopDevice) return;
      userWantsKeepAwakeRef.current = !!enabled;
      syncWakeLockDebounced();
    },
    [syncWakeLockDebounced],
  );

  // Register the same document/window listeners the original module registered.
  useEffect(() => {
    const onVisibilityChange = () => syncWakeLockDebounced();
    const onEnterPip = () => releaseWakeLock();
    const onLeavePip = () => syncWakeLockDebounced();
    const onPageHide = () => releaseWakeLock();

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("enterpictureinpicture", onEnterPip);
    document.addEventListener("leavepictureinpicture", onLeavePip);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("enterpictureinpicture", onEnterPip);
      document.removeEventListener("leavepictureinpicture", onLeavePip);
      window.removeEventListener("pagehide", onPageHide);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      // Release on unmount so we don't leak an active wake lock.
      releaseWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync whenever the call-state inputs change, since the original
  // relied on external code calling sync whenever these globals changed.
  useEffect(() => {
    syncWakeLockDebounced();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktopDevice, audioStatus, videoStatus, screenStatus]);

  return {
    keepAwakeActive,
    setKeepAwake,
    isSupported: isWakeLockSupported(),
  };
}

export default useWakeLock;
