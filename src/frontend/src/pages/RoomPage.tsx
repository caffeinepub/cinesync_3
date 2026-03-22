import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import AdminDashboard from "../components/AdminDashboard";
import ChatPanel from "../components/ChatPanel";
import ParticipantsList from "../components/ParticipantsList";
import RequestControls from "../components/RequestControls";
import StickyHeader from "../components/StickyHeader";
import VideoPlayer, { type VideoPlayerHandle } from "../components/VideoPlayer";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useSyncEngine } from "../hooks/useSyncEngine";

interface RoomPageProps {
  roomCode: string;
  nickname: string;
  isHostInitial: boolean;
  onLeaveRoom: () => void;
}

export default function RoomPage({
  roomCode,
  nickname,
  isHostInitial,
  onLeaveRoom,
}: RoomPageProps) {
  const { identity } = useInternetIdentity();
  const { actor } = useActor();

  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<VideoPlayerHandle | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [isSynced, setIsSynced] = useState(true);

  const isHostRef = useRef(isHostInitial);
  const isHost = isHostRef.current;

  const { roomState, isLoading, error, pushPlayback } = useSyncEngine({
    roomCode,
    enabled: true,
  });

  const isHostConfirmed = (() => {
    if (isHost) return true;
    if (!roomState || !identity) return false;
    const principalStr = identity.getPrincipal().toString();
    const creatorStr = roomState.creator?.toString?.() ?? "";
    return !!(principalStr && creatorStr && principalStr === creatorStr);
  })();

  const effectiveIsHost = isHost || isHostConfirmed;

  const prevVideoSource = useRef("");
  const syncIgnoreUntil = useRef(0);
  const prevSyncVersionRef = useRef<bigint>(BigInt(0));

  // Predictive sync refs — track when we last received a sync and what position it was at
  const syncReceivedAtRef = useRef<number>(0);
  const syncReceivedPositionRef = useRef<number>(0);

  useEffect(() => {
    if (!roomState || effectiveIsHost) return;
    const now = Date.now();
    if (now < syncIgnoreUntil.current) return;

    const video = videoRef.current;
    if (!video) return;

    const currentSyncVersion = roomState.syncVersion ?? BigInt(0);
    const isForceSync = currentSyncVersion > prevSyncVersionRef.current;
    if (isForceSync) prevSyncVersionRef.current = currentSyncVersion;

    if (
      roomState.videoSource &&
      roomState.videoSource !== prevVideoSource.current
    ) {
      prevVideoSource.current = roomState.videoSource;
      setVideoSrc(roomState.videoSource);
      // Record the sync position when video first loads
      syncReceivedAtRef.current = Date.now();
      syncReceivedPositionRef.current = roomState.position;
      video.loadAndSync(
        roomState.videoSource,
        roomState.position,
        roomState.isPlaying,
      );
      return;
    }

    if (isForceSync) {
      syncReceivedAtRef.current = Date.now();
      syncReceivedPositionRef.current = roomState.position;
      video.seek(roomState.position);
      if (roomState.isPlaying) {
        video.play();
      } else {
        video.pause();
      }
      setIsSynced(true);
      toast("Synced by host", { duration: 2000 });
      return;
    }

    // Update predictive sync tracking on every poll
    syncReceivedAtRef.current = Date.now();
    syncReceivedPositionRef.current = roomState.position;

    const localPaused = video.getIsPaused();
    if (roomState.isPlaying && localPaused) {
      video.play();
    } else if (!roomState.isPlaying && !localPaused) {
      video.pause();
    }

    // Use predictive position: account for time elapsed since server's position snapshot
    const elapsed = (Date.now() - syncReceivedAtRef.current) / 1000;
    const expectedPosition =
      syncReceivedPositionRef.current + (roomState.isPlaying ? elapsed : 0);
    const localTime = video.getCurrentTime();
    const drift = Math.abs(localTime - expectedPosition);
    if (drift > 2) {
      video.seek(expectedPosition);
      setIsSynced(false);
      setTimeout(() => setIsSynced(true), 1000);
    }
  }, [roomState, effectiveIsHost]);

  useEffect(() => {
    if (!roomState || !effectiveIsHost) return;
    if (
      roomState.videoSource &&
      roomState.videoSource !== prevVideoSource.current
    ) {
      prevVideoSource.current = roomState.videoSource;
      setVideoSrc(roomState.videoSource);
      videoRef.current?.setSource(roomState.videoSource);
    }
  }, [roomState, effectiveIsHost]);

  useEffect(() => {
    if (!effectiveIsHost) return;
    // Reduced to 6s since participants now predict position locally
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      if (!video.getIsPaused()) {
        pushPlayback(true, video.getCurrentTime());
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [effectiveIsHost, pushPlayback]);

  const handleVideoPlay = useCallback(
    (currentTime: number) => {
      if (!effectiveIsHost) return;
      syncIgnoreUntil.current = Date.now() + 1000;
      pushPlayback(true, currentTime);
    },
    [effectiveIsHost, pushPlayback],
  );

  const handleVideoPause = useCallback(
    (currentTime: number) => {
      if (!effectiveIsHost) return;
      syncIgnoreUntil.current = Date.now() + 1000;
      pushPlayback(false, currentTime);
    },
    [effectiveIsHost, pushPlayback],
  );

  const handleVideoSeeked = useCallback(
    (currentTime: number) => {
      if (!effectiveIsHost) return;
      syncIgnoreUntil.current = Date.now() + 1000;
      const paused = videoRef.current?.getIsPaused() ?? true;
      pushPlayback(!paused, currentTime);
    },
    [effectiveIsHost, pushPlayback],
  );

  const handleSetSource = useCallback(
    async (src: string) => {
      if (!effectiveIsHost || !actor) return;
      setVideoSrc(src);
      try {
        await actor.setVideoSource({ roomCode, videoSource: src });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to set video source",
        );
      }
    },
    [effectiveIsHost, actor, roomCode],
  );

  const handleForceSyncAll = useCallback(async () => {
    if (!actor || !videoRef.current) return;
    const currentTime = videoRef.current.getCurrentTime();
    const isPaused = videoRef.current.getIsPaused();
    const playing = !isPaused;
    await actor.forceSyncAll({
      roomCode,
      position: currentTime,
      isPlaying: playing,
    });
    pushPlayback(playing, currentTime);
  }, [actor, roomCode, pushPlayback]);

  const handleLeave = useCallback(async () => {
    if (!actor) {
      onLeaveRoom();
      return;
    }
    try {
      await actor.leaveRoom({ roomCode, nickname });
    } catch {
      // ignore
    }
    onLeaveRoom();
  }, [actor, roomCode, nickname, onLeaveRoom]);

  const participants = roomState?.participants ?? [];
  const messages = roomState?.chatMessages ?? [];
  const hostNickname = roomState?.hostNickname ?? "";

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        data-ocid="room.loading_state"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          <p className="text-sm text-muted-foreground">Connecting to room...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        data-ocid="room.error_state"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-sm mx-auto px-4"
        >
          <p className="text-foreground font-semibold mb-2">Room not found</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="text-sm text-gold hover:text-gold/80 transition-colors"
            data-ocid="room.back.button"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="h-screen overflow-hidden bg-background flex flex-col"
    >
      <StickyHeader
        roomCode={roomCode}
        participantCount={participants.length}
        isSynced={isSynced}
        onLeave={handleLeave}
      />

      {/* Main layout: 70% video / 30% chat — both desktop and mobile */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left / top: video area (70%) */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ flex: "7", minWidth: 0 }}
        >
          <div className="p-3 md:p-4 relative">
            <VideoPlayer
              ref={videoRef}
              src={videoSrc}
              isHost={effectiveIsHost}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onSeeked={handleVideoSeeked}
              onSetSource={handleSetSource}
              fullscreenContainerRef={rootRef}
            />
            {adminUnlocked && effectiveIsHost && (
              <AdminDashboard
                roomCode={roomCode}
                onClose={() => setAdminUnlocked(false)}
                onVideoSourceChange={(src) => {
                  setVideoSrc(src);
                  videoRef.current?.setSource(src);
                }}
                onForceSyncAll={handleForceSyncAll}
              />
            )}
          </div>

          {!effectiveIsHost && (
            <div className="px-3 md:px-4">
              <RequestControls
                roomCode={roomCode}
                nickname={nickname}
                isHost={false}
              />
            </div>
          )}

          {/* Room info bar */}
          <div className="mx-3 md:mx-4 mt-2 mb-3 flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card">
            <div>
              <h1 className="text-sm font-semibold text-foreground">
                Room: {roomCode.toUpperCase()}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {effectiveIsHost
                  ? "You are the host"
                  : `Hosted by ${hostNickname}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isSynced
                    ? "oklch(var(--status-green))"
                    : "oklch(var(--status-yellow))",
                }}
              />
              <span className="text-xs text-muted-foreground">
                {isSynced ? "Live" : "Syncing"}
              </span>
            </div>
          </div>

          {/* Participants list — hidden on small screens to save space */}
          <div className="hidden md:block px-4 pb-4">
            <ParticipantsList
              participants={participants}
              hostNickname={hostNickname}
              currentNickname={nickname}
            />
          </div>
        </div>

        {/* Right / bottom: chat (30%) */}
        <div
          className="flex flex-col border-l border-border"
          style={{ flex: "3", minWidth: 0 }}
        >
          <ChatPanel
            messages={messages}
            roomCode={roomCode}
            nickname={nickname}
            isHost={effectiveIsHost}
            onAdminUnlock={() => setAdminUnlocked(true)}
            className="h-full rounded-none border-0"
          />
        </div>
      </div>
    </motion.div>
  );
}
