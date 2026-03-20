import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Check,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
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
  ({ src, isHost, onPlay, onPause, onSeeked, onSetSource }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTimeUpdateRef = useRef(0);
    const internalTimeRef = useRef(0);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlInputValue, setUrlInputValue] = useState(src || "");
    const [hasSrc, setHasSrc] = useState(!!src);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
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
      getCurrentTime: () => internalTimeRef.current,
      getIsPaused: () => videoRef.current?.paused ?? true,
    }));

    // Sync src prop changes
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
      const handler = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", handler);
      return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

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
      const video = videoRef.current;
      if (!video || !hasSrc) return;
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const newTime = (Number(e.target.value) / 100) * duration;
      video.currentTime = newTime;
      setCurrentTime(newTime);
      onSeeked?.(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value) / 100;
      setVolume(v);
      if (videoRef.current) {
        videoRef.current.volume = v;
        videoRef.current.muted = v === 0;
        setIsMuted(v === 0);
      }
    };

    const toggleMute = () => {
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

    const toggleFullscreen = () => {
      const container = containerRef.current;
      if (!container) return;
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
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
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onSeeked={() => onSeeked?.(videoRef.current?.currentTime ?? 0)}
          onClick={togglePlay}
          onKeyDown={(e) => e.key === " " && togglePlay()}
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
              placeholder="Paste video URL (MP4, HLS)..."
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

        {/* Big play/pause button (center) */}
        {hasSrc && !isPlaying && (
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
            {/* Progress scrubber */}
            <div className="mb-2 relative">
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleProgressChange}
                className="video-scrubber video-scrubber-fill w-full"
                style={{ "--progress": `${progress}%` } as React.CSSProperties}
                data-ocid="video.scrubber.input"
              />
            </div>

            {/* Control row */}
            <div className="flex items-center justify-between gap-3">
              {/* Left */}
              <div className="flex items-center gap-2">
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
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right */}
              <div className="flex items-center gap-3">
                {/* Volume */}
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

                {/* Fullscreen */}
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
