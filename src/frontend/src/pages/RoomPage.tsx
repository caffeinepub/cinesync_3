import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import AdminDashboard from "../components/AdminDashboard";
import ChatPanel from "../components/ChatPanel";
import MobileChatDrawer from "../components/MobileChatDrawer";
import ParticipantsList from "../components/ParticipantsList";
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

  const videoRef = useRef<VideoPlayerHandle | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [isSynced, setIsSynced] = useState(true);

  const { roomState, isLoading, error, pushPlayback } = useSyncEngine({
    roomCode,
    enabled: true,
  });

  // Determine if current user is host
  const isHost = (() => {
    if (!roomState) return isHostInitial;
    const principalStr = identity?.getPrincipal().toString() ?? "";
    const creatorStr = roomState.creator?.toString?.() ?? "";
    if (principalStr && creatorStr && principalStr === creatorStr) return true;
    return nickname === roomState.hostNickname;
  })();

  // Sync engine: apply room state changes to video (guest only)
  const prevVideoSource = useRef("");
  const prevIsPlaying = useRef<boolean | null>(null);
  const syncIgnoreUntil = useRef(0);

  useEffect(() => {
    if (!roomState || isHost) return;
    const now = Date.now();
    if (now < syncIgnoreUntil.current) return;

    const video = videoRef.current;
    if (!video) return;

    // Sync video source
    if (
      roomState.videoSource &&
      roomState.videoSource !== prevVideoSource.current
    ) {
      prevVideoSource.current = roomState.videoSource;
      setVideoSrc(roomState.videoSource);
      video.setSource(roomState.videoSource);
    }

    // Sync play/pause
    const localPaused = video.getIsPaused();
    if (roomState.isPlaying !== prevIsPlaying.current) {
      prevIsPlaying.current = roomState.isPlaying;
      if (roomState.isPlaying && localPaused) {
        video.play();
      } else if (!roomState.isPlaying && !localPaused) {
        video.pause();
      }
    }

    // Sync position (if drift > 2s)
    const localTime = video.getCurrentTime();
    const drift = Math.abs(roomState.position - localTime);
    if (drift > 2) {
      video.seek(roomState.position);
      setIsSynced(false);
      setTimeout(() => setIsSynced(true), 1000);
    }
  }, [roomState, isHost]);

  // For host: also sync video source if changed externally (e.g. admin panel)
  useEffect(() => {
    if (!roomState || !isHost) return;
    if (
      roomState.videoSource &&
      roomState.videoSource !== prevVideoSource.current
    ) {
      prevVideoSource.current = roomState.videoSource;
      setVideoSrc(roomState.videoSource);
      videoRef.current?.setSource(roomState.videoSource);
    }
  }, [roomState, isHost]);

  // Host handlers
  const handleVideoPlay = useCallback(
    (currentTime: number) => {
      if (!isHost) return;
      syncIgnoreUntil.current = Date.now() + 1000;
      pushPlayback(true, currentTime);
    },
    [isHost, pushPlayback],
  );

  const handleVideoPause = useCallback(
    (currentTime: number) => {
      if (!isHost) return;
      syncIgnoreUntil.current = Date.now() + 1000;
      pushPlayback(false, currentTime);
    },
    [isHost, pushPlayback],
  );

  const handleVideoSeeked = useCallback(
    (currentTime: number) => {
      if (!isHost) return;
      syncIgnoreUntil.current = Date.now() + 1000;
      const paused = videoRef.current?.getIsPaused() ?? true;
      pushPlayback(!paused, currentTime);
    },
    [isHost, pushPlayback],
  );

  const handleSetSource = useCallback(
    async (src: string) => {
      if (!isHost || !actor) return;
      setVideoSrc(src);
      try {
        await actor.setVideoSource({ roomCode, videoSource: src });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to set video source",
        );
      }
    },
    [isHost, actor, roomCode],
  );

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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          <p className="text-sm text-muted-foreground">Connecting to room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        data-ocid="room.error_state"
      >
        <div className="text-center max-w-sm mx-auto px-4">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StickyHeader
        roomCode={roomCode}
        participantCount={participants.length}
        isSynced={isSynced}
        onLeave={handleLeave}
      />

      {/* Desktop layout */}
      <div
        className="hidden md:flex flex-1 gap-0 overflow-hidden"
        style={{ height: "calc(100vh - 56px)" }}
      >
        {/* Left: video + info */}
        <div className="flex flex-col flex-1 min-w-0 p-4 gap-4 overflow-y-auto">
          {/* Video player with admin overlay */}
          <div className="relative">
            <VideoPlayer
              ref={videoRef}
              src={videoSrc}
              isHost={isHost}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onSeeked={handleVideoSeeked}
              onSetSource={handleSetSource}
            />
            {adminUnlocked && isHost && (
              <AdminDashboard
                roomCode={roomCode}
                onClose={() => setAdminUnlocked(false)}
                onVideoSourceChange={(src) => {
                  setVideoSrc(src);
                  videoRef.current?.setSource(src);
                }}
              />
            )}
          </div>

          {/* Room info bar */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card">
            <div>
              <h1 className="text-sm font-semibold text-foreground">
                Room: {roomCode.toUpperCase()}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isHost ? "You are the host" : `Hosted by ${hostNickname}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "oklch(var(--status-green))" }}
              />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>

          {/* Participants list */}
          <ParticipantsList
            participants={participants}
            hostNickname={hostNickname}
            currentNickname={nickname}
          />
        </div>

        {/* Right: chat */}
        <div className="w-80 xl:w-96 border-l border-border flex flex-col p-4">
          <ChatPanel
            messages={messages}
            roomCode={roomCode}
            nickname={nickname}
            isHost={isHost}
            onAdminUnlock={() => setAdminUnlocked(true)}
            className="h-full"
          />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex flex-col flex-1 pb-14">
        <div className="p-3 relative">
          <VideoPlayer
            ref={videoRef}
            src={videoSrc}
            isHost={isHost}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onSeeked={handleVideoSeeked}
            onSetSource={handleSetSource}
          />
          {adminUnlocked && isHost && (
            <AdminDashboard
              roomCode={roomCode}
              onClose={() => setAdminUnlocked(false)}
              onVideoSourceChange={(src) => {
                setVideoSrc(src);
                videoRef.current?.setSource(src);
              }}
            />
          )}
        </div>

        {/* Participants (collapsed) */}
        <div className="px-3 pb-3">
          <div className="rounded-xl border border-border bg-card px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {participants.length} participant
              {participants.length !== 1 ? "s" : ""}
            </span>
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
                {isSynced ? "Synced" : "Syncing"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile chat drawer */}
      <div className="md:hidden">
        <MobileChatDrawer
          messages={messages}
          roomCode={roomCode}
          nickname={nickname}
          isHost={isHost}
          onAdminUnlock={() => setAdminUnlocked(true)}
        />
      </div>
    </div>
  );
}
