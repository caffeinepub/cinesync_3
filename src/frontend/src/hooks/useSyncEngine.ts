import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomState } from "../backend";
import { useActor } from "./useActor";

interface UseSyncEngineOptions {
  roomCode: string;
  enabled: boolean;
}

export interface SyncEngineResult {
  roomState: RoomState | null;
  isLoading: boolean;
  error: string | null;
  pushPlayback: (isPlaying: boolean, position: number) => void;
  refresh: () => void;
}

export function useSyncEngine({
  roomCode,
  enabled,
}: UseSyncEngineOptions): SyncEngineResult {
  const { actor, isFetching } = useActor();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCountRef = useRef(0);

  useEffect(() => {
    if (!enabled || !actor || isFetching || !roomCode) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const state = await actor.getRoomState(roomCode);
        if (!cancelled) {
          setRoomState(state);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Room not found");
          setIsLoading(false);
        }
      }
    };

    poll();
    // Reduced from 1500ms to 800ms for faster sync detection
    const interval = setInterval(poll, 800);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [actor, isFetching, roomCode, enabled]);

  const pushPlayback = useCallback(
    (isPlaying: boolean, position: number) => {
      if (!actor || !roomCode) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      // Reduced from 400ms to 80ms so host actions reach backend nearly instantly
      debounceTimer.current = setTimeout(async () => {
        try {
          await actor.updatePlaybackState({ isPlaying, position, roomCode });
        } catch (e) {
          console.error("Failed to push playback state", e);
        }
      }, 80);
    },
    [actor, roomCode],
  );

  const refresh = useCallback(() => {
    refreshCountRef.current += 1;
  }, []);

  return { roomState, isLoading, error, pushPlayback, refresh };
}
