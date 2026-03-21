import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Film, Loader2, LogIn, Play, Users, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

interface LandingPageProps {
  onEnterRoom: (roomCode: string, nickname: string, isHost: boolean) => void;
}

export default function LandingPage({ onEnterRoom }: LandingPageProps) {
  const { identity, login, clear, loginStatus } = useInternetIdentity();
  const {
    actor,
    isFetching: actorFetching,
    isError: actorIsError,
  } = useActor();
  const actorError = actorIsError && !actorFetching;
  const qc = useQueryClient();

  const [createCode, setCreateCode] = useState("");
  const [createNickname, setCreateNickname] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === "logging-in";

  const handleCreate = async () => {
    if (!createCode.trim() || !createNickname.trim()) {
      toast.error("Please enter a room code and nickname");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Please log in to create a room");
      return;
    }
    if (!actor) {
      if (actorError) {
        toast.error("Backend unavailable — please refresh the page");
      } else {
        toast.error(
          "Still connecting to backend, please try again in a moment",
        );
      }
      return;
    }
    setCreateLoading(true);
    try {
      await actor.createRoom({
        roomCode: createCode.trim(),
        hostNickname: createNickname.trim(),
      });
      qc.invalidateQueries({ queryKey: ["roomState", createCode.trim()] });
      onEnterRoom(createCode.trim(), createNickname.trim(), true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !joinNickname.trim()) {
      toast.error("Please enter a room code and nickname");
      return;
    }
    if (!actor) {
      if (actorError) {
        toast.error("Backend unavailable — please refresh the page");
      } else {
        toast.error(
          "Still connecting to backend, please try again in a moment",
        );
      }
      return;
    }
    setJoinLoading(true);
    try {
      await actor.joinRoom(joinCode.trim(), joinNickname.trim());
      qc.invalidateQueries({ queryKey: ["roomState", joinCode.trim()] });
      onEnterRoom(joinCode.trim(), joinNickname.trim(), false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to join room. Check room code.",
      );
    } finally {
      setJoinLoading(false);
    }
  };

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      qc.clear();
    } else {
      try {
        await login();
      } catch (e) {
        console.error("Login error", e);
      }
    }
  };

  // Derive create button state
  const isConnecting = actorFetching && isAuthenticated && !actorError;
  const hasBackendError = actorError && isAuthenticated;

  const createButtonLabel = createLoading
    ? "Creating..."
    : hasBackendError
      ? "Backend Error — Refresh"
      : isConnecting
        ? "Connecting..."
        : "Create Room";

  const createButtonDisabled =
    !isAuthenticated || createLoading || hasBackendError;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Film className="w-4 h-4 text-gold" />
            </div>
            <span className="font-semibold text-foreground text-lg tracking-tight">
              Cine<span className="text-gold">Sync</span>
            </span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {["Home", "Features", "How It Works"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-ocid={`nav.${item.toLowerCase().replace(" ", "-")}.link`}
              >
                {item}
              </a>
            ))}
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAuth}
              disabled={isLoggingIn}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              data-ocid="nav.login.button"
            >
              {isLoggingIn ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              {isAuthenticated ? "Logout" : "Login"}
            </button>
            <Button
              size="sm"
              onClick={() =>
                document
                  .getElementById("create-section")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="border border-gold/40 bg-secondary text-foreground hover:bg-gold/10 hover:border-gold/60 transition-all"
              data-ocid="nav.create_room.button"
            >
              Create Room
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              "url('/assets/generated/cinesync-hero.dim_1600x600.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-medium tracking-widest uppercase mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-pulse-slow" />
              Watch Together in Perfect Sync
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight">
              Cinema-Grade
              <br />
              <span className="text-gold">Watch Parties</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Create a room, share the code, and watch any video perfectly
              synced with anyone in the world.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Action Cards */}
      <section
        id="create-section"
        className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-12"
      >
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Room */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-xl border border-gold/25 bg-card p-6 flex flex-col gap-5 shadow-panel"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center">
                <Play className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Create a Room
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Requires login — you&apos;ll be the host
                </p>
              </div>
            </div>

            {!isAuthenticated && (
              <div className="rounded-lg bg-gold/5 border border-gold/20 p-3 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={handleAuth}
                  className="text-gold hover:text-gold/80 font-medium transition-colors"
                  data-ocid="create.login.button"
                >
                  Sign in with Internet Identity
                </button>{" "}
                to create and host a watch room.
              </div>
            )}

            {hasBackendError && (
              <div
                className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive"
                data-ocid="create.error_state"
              >
                Backend connection failed. Please refresh the page to try again.
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Room Code
                </Label>
                <Input
                  placeholder="e.g. movienight42"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  disabled={!isAuthenticated}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10"
                  data-ocid="create.code.input"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Your Nickname
                </Label>
                <Input
                  placeholder="e.g. Alex"
                  value={createNickname}
                  onChange={(e) => setCreateNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  disabled={!isAuthenticated}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10"
                  data-ocid="create.nickname.input"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={createButtonDisabled}
                className="w-full bg-gold text-background hover:bg-gold/90 font-semibold h-10 mt-1 disabled:opacity-60"
                data-ocid="create.submit.button"
              >
                {(createLoading || isConnecting) && !hasBackendError ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {createButtonLabel}
              </Button>
            </div>
          </motion.div>

          {/* Join Room */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl border border-border bg-card p-6 flex flex-col gap-5 shadow-panel"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Join a Room
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No account required — guests welcome
                </p>
              </div>
            </div>

            {actorError && (
              <div
                className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive"
                data-ocid="join.error_state"
              >
                Backend connection failed. Please refresh the page to try again.
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Room Code
                </Label>
                <Input
                  placeholder="Enter room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10"
                  data-ocid="join.code.input"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Your Nickname
                </Label>
                <Input
                  placeholder="e.g. Jordan"
                  value={joinNickname}
                  onChange={(e) => setJoinNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10"
                  data-ocid="join.nickname.input"
                />
              </div>
              <Button
                onClick={handleJoin}
                disabled={joinLoading}
                variant="outline"
                className="w-full border-border bg-secondary text-foreground hover:bg-card hover:border-gold/40 font-semibold h-10 mt-1 transition-all"
                data-ocid="join.submit.button"
              >
                {joinLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {joinLoading ? "Joining..." : "Join Room"}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="max-w-5xl mx-auto w-full px-4 sm:px-6 pb-16"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: Zap,
              title: "Real-Time Sync",
              desc: "Play, pause, and seek in perfect sync across all viewers.",
            },
            {
              icon: Film,
              title: "Any Video Source",
              desc: "Paste any MP4 or HLS URL and watch instantly together.",
            },
            {
              icon: Users,
              title: "Built-In Chat",
              desc: "React in real-time with an integrated chat panel.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card/50 p-5 flex flex-col gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-1">
                <Icon className="w-4 h-4 text-gold" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-foreground">
              Cine<span className="text-gold">Sync</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()}. Built with{" "}
            <span className="text-gold">&hearts;</span> using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold/80 transition-colors"
            >
              caffeine.ai
            </a>
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Copy className="w-3 h-3" />
            <span>Share your room code to invite friends</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
