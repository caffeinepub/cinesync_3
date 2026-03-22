import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  Languages,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  Smartphone,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface VideoPlayerHandle {
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  setSource: (src: string) => void;
  loadAndSync: (src: string, position: number, shouldPlay: boolean) => void;
  getCurrentTime: () => number;
  getIsPaused: () => boolean;
}

interface VideoPlayerProps {
  src: string;
  isHost: boolean;
  onPlay?: (currentTime: number) => void;
  onPause?: (currentTime: number) => void;
  onSeeked?: (currentTime: number) => void;
  onSetSource?: (src: string) => void;
  fullscreenContainerRef?: React.RefObject<HTMLDivElement | null>;
}

interface AudioTrackInfo {
  id: string;
  label: string;
  language: string;
  enabled: boolean;
}

interface TextTrackInfo {
  index: number;
  label: string;
  language: string;
  kind: string;
  mode: TextTrackMode;
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = String(s % 60).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (
    {
      src,
      isHost,
      onPlay,
      onPause,
      onSeeked,
      onSetSource,
      fullscreenContainerRef,
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTimeUpdateRef = useRef(0);
    const internalTimeRef = useRef(0);
    const pendingCanPlayRef = useRef<(() => void) | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlInputValue, setUrlInputValue] = useState(src || "");
    const [hasSrc, setHasSrc] = useState(!!src);

    // Track panels
    const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
    const [textTracks, setTextTracks] = useState<TextTrackInfo[]>([]);
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [showSubMenu, setShowSubMenu] = useState(false);
    const [activeSubIndex, setActiveSubIndex] = useState<number | null>(null);

    // Refresh track lists from video element
    const refreshTracks = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      // Audio tracks (Firefox + some browsers)
      const at = (video as any).audioTracks as
        | {
            length: number;
            [index: number]: {
              id: string;
              label: string;
              language: string;
              enabled: boolean;
            };
          }
        | undefined;
      if (at && at.length > 1) {
        const tracks: AudioTrackInfo[] = [];
        for (let i = 0; i < at.length; i++) {
          const t = at[i] as any;
          tracks.push({
            id: t.id || String(i),
            label: t.label || t.language || `Track ${i + 1}`,
            language: t.language || "",
            enabled: t.enabled,
          });
        }
        setAudioTracks(tracks);
      } else {
        setAudioTracks([]);
      }

      // Text tracks (subtitles/captions)
      const tt = video.textTracks;
      if (tt && tt.length > 0) {
        const tracks: TextTrackInfo[] = [];
        for (let i = 0; i < tt.length; i++) {
          const t = tt[i];
          if (
            t.kind === "subtitles" ||
            t.kind === "captions" ||
            t.kind === "descriptions"
          ) {
            tracks.push({
              index: i,
              label: t.label || t.language || `Subtitle ${tracks.length + 1}`,
              language: t.language || "",
              kind: t.kind,
              mode: t.mode,
            });
          }
        }
        setTextTracks(tracks);
      } else {
        setTextTracks([]);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      play: () => {
        videoRef.current?.play().catch(() => {});
      },
      pause: () => {
        videoRef.current?.pause();
      },
      setSource: (newSrc: string) => {
        if (videoRef.current && newSrc) {
          videoRef.current.src = newSrc;
          videoRef.current.load();
          setHasSrc(true);
          setUrlInputValue(newSrc);
        }
      },
      loadAndSync: (newSrc: string, position: number, shouldPlay: boolean) => {
        const video = videoRef.current;
        if (!video || !newSrc) return;
        if (pendingCanPlayRef.current) {
          video.removeEventListener("canplay", pendingCanPlayRef.current);
          pendingCanPlayRef.current = null;
        }
        const onCanPlay = () => {
          video.removeEventListener("canplay", onCanPlay);
          pendingCanPlayRef.current = null;
          video.currentTime = position;
          if (shouldPlay) video.play().catch(() => {});
        };
        pendingCanPlayRef.current = onCanPlay;
        video.addEventListener("canplay", onCanPlay);
        video.src = newSrc;
        video.load();
        setHasSrc(true);
        setUrlInputValue(newSrc);
      },
      getCurrentTime: () => internalTimeRef.current,
      getIsPaused: () => videoRef.current?.paused ?? true,
    }));

    useEffect(() => {
      return () => {
        const video = videoRef.current;
        if (video && pendingCanPlayRef.current) {
          video.removeEventListener("canplay", pendingCanPlayRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (src && videoRef.current && src !== videoRef.current.src) {
        videoRef.current.src = src;
        videoRef.current.load();
        setHasSrc(true);
        setUrlInputValue(src);
      }
    }, [src]);

    // Fullscreen listener
    useEffect(() => {
      const handler = () => {
        const inFullscreen = !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement
        );
        setIsFullscreen(inFullscreen);
        if (!inFullscreen) {
          setIsLandscape(false);
          try {
            (screen.orientation as any).unlock();
          } catch {
            /* ignore */
          }
        }
      };
      document.addEventListener("fullscreenchange", handler);
      document.addEventListener("webkitfullscreenchange", handler);
      return () => {
        document.removeEventListener("fullscreenchange", handler);
        document.removeEventListener("webkitfullscreenchange", handler);
      };
    }, []);

    // Close track menus on click outside
    useEffect(() => {
      if (!showLangMenu && !showSubMenu) return;
      const close = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-track-menu]")) {
          setShowLangMenu(false);
          setShowSubMenu(false);
        }
      };
      document.addEventListener("mousedown", close);
      return () => document.removeEventListener("mousedown", close);
    }, [showLangMenu, showSubMenu]);

    const showControls = useCallback(() => {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (isPlaying) {
        hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
      }
    }, [isPlaying]);

    useEffect(() => {
      if (!isPlaying) {
        setControlsVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
      } else {
        hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
      }
      return () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      };
    }, [isPlaying]);

    const togglePlay = () => {
      if (!isHost) return;
      const video = videoRef.current;
      if (!video || !hasSrc) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isHost) return;
      const video = videoRef.current;
      if (!video) return;
      const newTime = (Number(e.target.value) / 100) * duration;
      video.currentTime = newTime;
      setCurrentTime(newTime);
      onSeeked?.(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isHost) return;
      const v = Number(e.target.value) / 100;
      setVolume(v);
      if (videoRef.current) {
        videoRef.current.volume = v;
        videoRef.current.muted = v === 0;
        setIsMuted(v === 0);
      }
    };

    const toggleMute = () => {
      if (!isHost) return;
      const video = videoRef.current;
      if (!video) return;
      if (isMuted) {
        video.muted = false;
        video.volume = volume || 0.7;
        setIsMuted(false);
      } else {
        video.muted = true;
        setIsMuted(true);
      }
    };

    const toggleFullscreen = async () => {
      const video = videoRef.current;
      const targetEl = fullscreenContainerRef?.current ?? containerRef.current;
      if (!targetEl) return;

      if (
        !document.fullscreenElement &&
        !(document as any).webkitFullscreenElement
      ) {
        const wasPlaying = !(video?.paused ?? true);
        try {
          await targetEl.requestFullscreen();
        } catch {
          /* ignore */
        }
        if (wasPlaying) {
          setTimeout(() => {
            video?.play().catch(() => {});
          }, 100);
        }
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    const toggleLandscape = async () => {
      const video = videoRef.current;
      const targetEl = fullscreenContainerRef?.current ?? containerRef.current;
      if (!targetEl || !video) return;

      if (isLandscape) {
        // Exit
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
        setIsLandscape(false);
        try {
          (screen.orientation as any).unlock();
        } catch {
          /* ignore */
        }
      } else {
        setIsLandscape(true);
        const wasPlaying = !video.paused;
        try {
          if (
            !document.fullscreenElement &&
            !(document as any).webkitFullscreenElement
          ) {
            await targetEl.requestFullscreen();
          }
          // Lock orientation to landscape (Android Chrome, etc.)
          try {
            await (screen.orientation as any).lock("landscape");
          } catch {
            // Desktop / unsupported — fullscreen alone is sufficient
          }
          // Resume playback after layout settles
          if (wasPlaying) {
            setTimeout(() => {
              video.play().catch(() => {});
            }, 100);
          }
        } catch {
          setIsLandscape(false);
        }
      }
    };

    const switchAudioTrack = (trackId: string) => {
      const video = videoRef.current;
      const at = (video as any)?.audioTracks as
        | {
            length: number;
            [index: number]: {
              id: string;
              label: string;
              language: string;
              enabled: boolean;
            };
          }
        | undefined;
      if (!at) return;
      for (let i = 0; i < at.length; i++) {
        (at[i] as any).enabled = (at[i] as any).id === trackId;
      }
      setAudioTracks((prev) =>
        prev.map((t) => ({ ...t, enabled: t.id === trackId })),
      );
      setShowLangMenu(false);
    };

    const switchSubtitle = (index: number | null) => {
      const video = videoRef.current;
      if (!video) return;
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = i === index ? "showing" : "hidden";
      }
      setActiveSubIndex(index);
      setTextTracks((prev) =>
        prev.map((t) => ({
          ...t,
          mode:
            t.index === index
              ? ("showing" as TextTrackMode)
              : ("hidden" as TextTrackMode),
        })),
      );
      setShowSubMenu(false);
    };

    const handleApplyUrl = () => {
      const url = urlInputValue.trim();
      if (!url) return;
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
        setHasSrc(true);
      }
      onSetSource?.(url);
      setShowUrlInput(false);
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const activeAudioLabel = audioTracks.find((t) => t.enabled)?.label;
    const activeSubLabel =
      activeSubIndex !== null
        ? textTracks.find((t) => t.index === activeSubIndex)?.label
        : null;

    return (
      <div
        ref={containerRef}
        className="relative w-full bg-black overflow-hidden rounded-xl group"
        style={{ aspectRatio: "16/9" }}
        onMouseMove={showControls}
        onTouchStart={showControls}
        data-ocid="video.canvas_target"
      >
        {/* Video element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onPlay={() => {
            setIsPlaying(true);
            onPlay?.(videoRef.current?.currentTime ?? 0);
          }}
          onPause={() => {
            setIsPlaying(false);
            onPause?.(videoRef.current?.currentTime ?? 0);
          }}
          onTimeUpdate={() => {
            const t = videoRef.current?.currentTime ?? 0;
            internalTimeRef.current = t;
            const now = performance.now();
            if (now - lastTimeUpdateRef.current >= 250) {
              lastTimeUpdateRef.current = now;
              setCurrentTime(t);
            }
          }}
          onLoadedMetadata={() => {
            setDuration(videoRef.current?.duration ?? 0);
            // Delay slightly so tracks are fully registered
            setTimeout(refreshTracks, 200);
          }}
          onSeeked={() => onSeeked?.(videoRef.current?.currentTime ?? 0)}
          onClick={isHost ? togglePlay : undefined}
          onKeyDown={(e) => isHost && e.key === " " && togglePlay()}
          playsInline
        >
          <track kind="captions" />
        </video>

        {/* No source placeholder */}
        {!hasSrc && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center border border-border">
              <Play className="w-7 h-7 text-muted-foreground ml-1" />
            </div>
            <p className="text-sm text-muted-foreground">
              {isHost
                ? "Set a video URL to start watching"
                : "Waiting for host to set a video..."}
            </p>
            {isHost && (
              <Button
                size="sm"
                onClick={() => setShowUrlInput(true)}
                className="border border-gold/40 bg-secondary text-foreground hover:bg-gold/10 text-xs"
                data-ocid="video.set_source.button"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Set Video URL
              </Button>
            )}
          </div>
        )}

        {/* LIVE SYNC badge */}
        {hasSrc && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/70 backdrop-blur-sm border border-status-green/30">
            <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-pulse-slow" />
            <span className="text-xs font-medium text-status-green tracking-widest uppercase">
              Live Sync
            </span>
          </div>
        )}

        {/* Host URL input toggle */}
        {isHost && hasSrc && (
          <div className="absolute top-3 right-3">
            <button
              type="button"
              onClick={() => setShowUrlInput((v) => !v)}
              className="p-1.5 rounded-lg bg-background/60 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
              data-ocid="video.set_source.button"
              title="Change video source"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* URL Input overlay */}
        {showUrlInput && (
          <div className="absolute inset-x-0 top-0 z-10 p-4 bg-background/90 backdrop-blur-md border-b border-border flex gap-2">
            <Input
              value={urlInputValue}
              onChange={(e) => setUrlInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyUrl()}
              placeholder="Paste video URL (MP4, MKV, HLS)..."
              className="flex-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground text-sm h-9"
              autoFocus
              data-ocid="video.url.input"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="p-2 rounded-lg bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 transition-colors"
              data-ocid="video.url.submit.button"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput(false)}
              className="p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Big play button (center) -- HOST ONLY */}
        {hasSrc && !isPlaying && isHost && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Play"
          >
            <div className="w-16 h-16 rounded-full bg-background/60 backdrop-blur-sm border border-border/60 flex items-center justify-center hover:bg-background/80 transition-colors">
              <Play className="w-7 h-7 text-foreground ml-1" />
            </div>
          </button>
        )}

        {/* Controls overlay */}
        {hasSrc && (
          <div
            className={cn(
              "absolute bottom-0 inset-x-0 px-4 pb-3 pt-8 transition-opacity duration-300",
              "bg-gradient-to-t from-black/80 via-black/40 to-transparent",
              controlsVisible || !isPlaying ? "opacity-100" : "opacity-0",
            )}
          >
            {/* Progress scrubber -- HOST ONLY */}
            {isHost && (
              <div className="mb-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleProgressChange}
                  className="video-scrubber video-scrubber-fill w-full"
                  style={
                    { "--progress": `${progress}%` } as React.CSSProperties
                  }
                  data-ocid="video.scrubber.input"
                />
              </div>
            )}

            {/* Control row */}
            <div className="flex items-center justify-between gap-2">
              {/* Left: play/pause + time */}
              <div className="flex items-center gap-2">
                {isHost && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="text-foreground hover:text-gold transition-colors"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    data-ocid="video.play_pause.button"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right: volume + lang + sub + landscape + fullscreen */}
              <div className="flex items-center gap-2">
                {/* Volume -- HOST ONLY */}
                {isHost && (
                  <div className="hidden sm:flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      data-ocid="video.mute.button"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : Math.round(volume * 100)}
                      onChange={handleVolumeChange}
                      className="volume-scrubber"
                      data-ocid="video.volume.input"
                    />
                  </div>
                )}

                {/* Audio language switcher -- everyone, only shown if >1 audio track */}
                {audioTracks.length > 1 && (
                  <div className="relative" data-track-menu>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLangMenu((v) => !v);
                        setShowSubMenu(false);
                      }}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors",
                        showLangMenu
                          ? "text-gold bg-gold/10 border border-gold/30"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title="Audio language"
                      data-ocid="video.lang.button"
                    >
                      <Languages className="w-3.5 h-3.5" />
                      {activeAudioLabel && (
                        <span className="hidden sm:inline max-w-[60px] truncate">
                          {activeAudioLabel}
                        </span>
                      )}
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {showLangMenu && (
                      <div className="absolute bottom-full right-0 mb-2 w-44 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-20">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Audio Language
                          </p>
                        </div>
                        {audioTracks.map((track) => (
                          <button
                            key={track.id}
                            type="button"
                            onClick={() => switchAudioTrack(track.id)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-secondary transition-colors",
                              track.enabled ? "text-gold" : "text-foreground",
                            )}
                          >
                            <span>
                              {track.label}
                              {track.language && track.language !== track.label
                                ? ` (${track.language})`
                                : ""}
                            </span>
                            {track.enabled && (
                              <Check className="w-3 h-3 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtitle track selector -- everyone, only shown if text tracks exist */}
                {textTracks.length > 0 && (
                  <div className="relative" data-track-menu>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSubMenu((v) => !v);
                        setShowLangMenu(false);
                      }}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors",
                        showSubMenu || activeSubIndex !== null
                          ? "text-gold bg-gold/10 border border-gold/30"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      title="Subtitles"
                      data-ocid="video.subtitles.button"
                    >
                      <Subtitles className="w-3.5 h-3.5" />
                      {activeSubLabel && (
                        <span className="hidden sm:inline max-w-[60px] truncate">
                          {activeSubLabel}
                        </span>
                      )}
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {showSubMenu && (
                      <div className="absolute bottom-full right-0 mb-2 w-44 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-20">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Subtitles
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => switchSubtitle(null)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-secondary transition-colors",
                            activeSubIndex === null
                              ? "text-gold"
                              : "text-foreground",
                          )}
                        >
                          <span>Off</span>
                          {activeSubIndex === null && (
                            <Check className="w-3 h-3 shrink-0" />
                          )}
                        </button>
                        {textTracks.map((track) => (
                          <button
                            key={track.index}
                            type="button"
                            onClick={() => switchSubtitle(track.index)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-secondary transition-colors",
                              activeSubIndex === track.index
                                ? "text-gold"
                                : "text-foreground",
                            )}
                          >
                            <span>
                              {track.label}
                              {track.language && track.language !== track.label
                                ? ` (${track.language})`
                                : ""}
                            </span>
                            {activeSubIndex === track.index && (
                              <Check className="w-3 h-3 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Landscape mode -- everyone */}
                <button
                  type="button"
                  onClick={toggleLandscape}
                  className={cn(
                    "transition-colors",
                    isLandscape
                      ? "text-gold hover:text-gold/70"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title={isLandscape ? "Exit landscape" : "Landscape mode"}
                  aria-label={
                    isLandscape ? "Exit landscape mode" : "Enter landscape mode"
                  }
                  data-ocid="video.landscape.button"
                >
                  <Smartphone
                    className="w-4 h-4"
                    style={{
                      transform: isLandscape ? "rotate(0deg)" : "rotate(90deg)",
                      transition: "transform 0.3s ease",
                    }}
                  />
                </button>

                {/* Fullscreen -- everyone */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-ocid="video.fullscreen.button"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4" />
                  ) : (
                    <Maximize className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";
export default VideoPlayer;
