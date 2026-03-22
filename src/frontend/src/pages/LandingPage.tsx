import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Film,
  Library,
  Loader2,
  LogIn,
  Play,
  Trash2,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useStorageClient } from "../hooks/useStorageClient";

interface LandingPageProps {
  onEnterRoom: (roomCode: string, nickname: string, isHost: boolean) => void;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isCanisterError =
        msg.includes("IC0508") ||
        msg.includes("IC0537") ||
        msg.includes("canister stopped") ||
        msg.includes("no wasm module");
      if (isCanisterError && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

const LIBRARY_CODE = "161189";

function LibraryPanel({ onClose }: { onClose: () => void }) {
  const { actor } = useActor();
  const { identity, login, loginStatus } = useInternetIdentity();
  const storageClient = useStorageClient();
  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === "logging-in";

  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [deletingSlot, setDeletingSlot] = useState<number | null>(null);
  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (storageClient) {
      setIsStorageLoading(false);
    }
  }, [storageClient]);

  const fetchLibrary = async () => {
    if (!actor) return;
    try {
      const items = await (actor as any).getLibrary();
      setLibrary(items);
    } catch {
      toast.error("Failed to load library");
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchLibrary is stable within render
  useEffect(() => {
    if (actor && isAuthenticated) {
      fetchLibrary();
    } else {
      setLoading(false);
    }
  }, [actor, isAuthenticated]);

  const getSlot = (slotIndex: number) =>
    library.find((item) => Number(item.slot) === slotIndex) ?? null;

  const handleUpload = async (slotIndex: number, file: File) => {
    if (!actor || !storageClient) {
      toast.error("Storage not ready");
      return;
    }
    setUploadingSlot(slotIndex);
    setUploadProgress(0);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { hash } = await storageClient.putFile(bytes, (pct) => {
        setUploadProgress(pct);
      });
      const url = await storageClient.getDirectURL(hash);
      await (actor as any).setLibrarySlot(BigInt(slotIndex), url, file.name);
      toast.success(`Slot ${slotIndex + 1} saved!`);
      await fetchLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingSlot(null);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (slotIndex: number) => {
    if (!actor) return;
    setDeletingSlot(slotIndex);
    try {
      await (actor as any).deleteLibrarySlot(BigInt(slotIndex));
      toast.success(`Slot ${slotIndex + 1} deleted`);
      await fetchLibrary();
    } catch {
      toast.error("Failed to delete slot");
    } finally {
      setDeletingSlot(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-ocid="library.modal"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="w-full max-w-md mx-4 rounded-xl border border-gold/30 bg-card shadow-panel overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center">
              <Library className="w-4 h-4 text-gold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Video Library
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                2 permanent slots — accessible from any room
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            data-ocid="library.close.button"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!isAuthenticated ? (
            <div className="rounded-lg bg-gold/5 border border-gold/20 p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to manage your video library
              </p>
              <Button
                onClick={login}
                disabled={isLoggingIn}
                className="bg-gold text-background hover:bg-gold/90 font-semibold"
                data-ocid="library.login.button"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="w-4 h-4 mr-2" />
                )}
                {isLoggingIn ? "Signing in..." : "Sign In"}
              </Button>
            </div>
          ) : loading ? (
            <div
              className="flex items-center justify-center py-8"
              data-ocid="library.loading_state"
            >
              <Loader2 className="w-5 h-5 animate-spin text-gold" />
            </div>
          ) : (
            <div className="space-y-3">
              {[0, 1].map((slotIndex) => {
                const item = getSlot(slotIndex);
                const isUploading = uploadingSlot === slotIndex;
                const isDeleting = deletingSlot === slotIndex;

                return (
                  <div
                    key={slotIndex}
                    className="rounded-xl border border-border bg-secondary/40 p-4"
                    data-ocid={`library.item.${slotIndex + 1}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
                          <Film className="w-4 h-4 text-gold" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gold uppercase tracking-wider mb-0.5">
                            Slot {slotIndex + 1}
                          </p>
                          {item ? (
                            <p className="text-sm text-foreground font-medium truncate max-w-[180px]">
                              {item.videoName}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Empty
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item ? (
                          <>
                            <label
                              htmlFor={`lib-replace-${slotIndex}`}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isStorageLoading || isUploading
                                  ? "opacity-50 cursor-not-allowed text-muted-foreground"
                                  : "cursor-pointer text-muted-foreground hover:text-gold hover:bg-gold/10"
                              }`}
                              title={
                                isStorageLoading
                                  ? "Storage initializing..."
                                  : "Replace video"
                              }
                              data-ocid={`library.upload_button.${slotIndex + 1}`}
                            >
                              {isStorageLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              <input
                                id={`lib-replace-${slotIndex}`}
                                ref={fileInputRefs[slotIndex]}
                                type="file"
                                accept="video/*,.mkv,video/x-matroska"
                                className="hidden"
                                disabled={isUploading || isStorageLoading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUpload(slotIndex, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDelete(slotIndex)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete slot"
                              data-ocid={`library.delete_button.${slotIndex + 1}`}
                            >
                              {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        ) : (
                          <label
                            htmlFor={`lib-upload-${slotIndex}`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              isStorageLoading || isUploading
                                ? "opacity-50 cursor-not-allowed bg-gold/5 border-gold/20 text-gold/60"
                                : "cursor-pointer bg-gold/10 border-gold/30 text-gold hover:bg-gold/20"
                            }`}
                            data-ocid={`library.upload_button.${slotIndex + 1}`}
                          >
                            {isStorageLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            {isStorageLoading ? "Initializing..." : "Upload"}
                            <input
                              id={`lib-upload-${slotIndex}`}
                              ref={fileInputRefs[slotIndex]}
                              type="file"
                              accept="video/*,.mkv,video/x-matroska"
                              className="hidden"
                              disabled={isUploading || isStorageLoading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(slotIndex, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {isUploading && (
                      <div
                        className="mt-3 space-y-1.5"
                        data-ocid="library.loading_state"
                      >
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Uploading to network...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-card rounded-full h-1.5">
                          <div
                            className="bg-gold h-1.5 rounded-full transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LandingPage({ onEnterRoom }: LandingPageProps) {
  const { identity, login, clear, loginStatus } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();
  // actorIsError: treat as error if not fetching and no actor after initial load
  const [actorLoadFailed, setActorLoadFailed] = useState(false);
  const actorIsError = actorLoadFailed;
  const refetchActor = () => {
    setActorLoadFailed(false);
    qc.invalidateQueries({ queryKey: ["actor"] });
  };
  const qc = useQueryClient();

  const [createCode, setCreateCode] = useState("");
  const [createNickname, setCreateNickname] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  const [showLibraryPrompt, setShowLibraryPrompt] = useState(false);
  const [libraryCode, setLibraryCode] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);

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
      if (!actorFetching) {
        toast.error("Backend unavailable — please use the Retry button");
      } else {
        toast.error(
          "Still connecting to backend, please try again in a moment",
        );
      }
      return;
    }
    setCreateLoading(true);
    try {
      await withRetry(() =>
        actor.createRoom({
          roomCode: createCode.trim(),
          hostNickname: createNickname.trim(),
        }),
      );
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
      if (!actorFetching) {
        toast.error("Backend unavailable — please use the Retry button");
      } else {
        toast.error(
          "Still connecting to backend, please try again in a moment",
        );
      }
      return;
    }
    setJoinLoading(true);
    try {
      await withRetry(() =>
        actor.joinRoom(joinCode.trim(), joinNickname.trim()),
      );
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

  const handleLibraryCodeSubmit = () => {
    if (libraryCode === LIBRARY_CODE) {
      setShowLibraryPrompt(false);
      setLibraryCode("");
      setShowLibrary(true);
    } else {
      toast.error("Incorrect access code");
      setLibraryCode("");
    }
  };

  const hasBackendError = actorIsError && !actorFetching;
  const isConnecting = actorFetching;

  const createButtonLabel = createLoading
    ? "Creating..."
    : isConnecting
      ? "Connecting..."
      : "Create Room";

  const createButtonDisabled =
    !isAuthenticated || createLoading || isConnecting || hasBackendError;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Library Panel */}
      <AnimatePresence>
        {showLibrary && <LibraryPanel onClose={() => setShowLibrary(false)} />}
      </AnimatePresence>

      {/* Library Code Prompt */}
      <AnimatePresence>
        {showLibraryPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
            onClick={(e) =>
              e.target === e.currentTarget && setShowLibraryPrompt(false)
            }
            data-ocid="library.dialog"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-80 mx-4 rounded-xl border border-gold/30 bg-card shadow-panel p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Library className="w-4 h-4 text-gold" />
                <h3 className="text-sm font-semibold text-foreground">
                  Library Access
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter access code to manage your video library
              </p>
              <Input
                placeholder="Enter access code"
                type="password"
                value={libraryCode}
                onChange={(e) => setLibraryCode(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleLibraryCodeSubmit()
                }
                autoFocus
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10"
                data-ocid="library.code.input"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLibraryPrompt(false);
                    setLibraryCode("");
                  }}
                  className="flex-1 border-border bg-secondary text-foreground hover:bg-card"
                  data-ocid="library.cancel.button"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLibraryCodeSubmit}
                  disabled={!libraryCode}
                  className="flex-1 bg-gold text-background hover:bg-gold/90 font-semibold"
                  data-ocid="library.confirm.button"
                >
                  Unlock
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          {/* Aurora Brand Text */}
          <style>{`
        @keyframes aurora-sweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes aurora-glow {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(0, 230, 230, 0.8)) drop-shadow(0 0 24px rgba(100, 0, 255, 0.4)); }
          50% { filter: drop-shadow(0 0 20px rgba(130, 0, 255, 0.9)) drop-shadow(0 0 40px rgba(0, 200, 200, 0.5)); }
        }
        @keyframes aurora-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes phi-glow {
          0%, 100% { filter: drop-shadow(0 0 16px rgba(0, 255, 220, 1)) drop-shadow(0 0 32px rgba(0, 200, 255, 0.8)) drop-shadow(0 0 48px rgba(100, 0, 255, 0.5)); }
          50% { filter: drop-shadow(0 0 24px rgba(200, 0, 255, 1)) drop-shadow(0 0 48px rgba(0, 220, 255, 0.9)) drop-shadow(0 0 64px rgba(0, 255, 200, 0.6)); }
        }
        .aurora-text {
          background: linear-gradient(90deg, #7b00ff 0%, #00e5ff 25%, #00ff9d 50%, #00cfff 75%, #8b00ff 100%);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: aurora-sweep 4s ease-in-out infinite, aurora-glow 3s ease-in-out infinite, aurora-float 6s ease-in-out infinite;
          display: inline-block;
        }
        .phi-char {
          -webkit-text-fill-color: transparent;
          background: linear-gradient(90deg, #00ffcc, #00e5ff, #00ffcc);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          animation: aurora-sweep 2s ease-in-out infinite, phi-glow 2s ease-in-out infinite;
          display: inline-block;
          position: relative;
        }
      `}</style>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            {/* Aur∅ra Animated Title */}
            <div className="mb-8">
              <span
                className="aurora-text text-6xl sm:text-7xl lg:text-8xl font-black tracking-tighter select-none"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: "-0.03em",
                }}
              >
                {[
                  { char: "A", key: "letter-A", delay: 0.1 },
                  { char: "u", key: "letter-u", delay: 0.18 },
                  { char: "r", key: "letter-r1", delay: 0.26 },
                  { char: "∅", key: "letter-phi", delay: 0.34 },
                  { char: "r", key: "letter-r2", delay: 0.42 },
                  { char: "a", key: "letter-a", delay: 0.5 },
                ].map(({ char, key, delay }) => (
                  <motion.span
                    key={key}
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay, ease: "easeOut" }}
                    className={char === "∅" ? "phi-char" : ""}
                    style={{ display: "inline-block" }}
                  >
                    {char}
                  </motion.span>
                ))}
              </span>
            </div>
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
                className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive flex items-center justify-between gap-2"
                data-ocid="create.error_state"
              >
                <span>Backend connection failed.</span>
                <button
                  type="button"
                  onClick={() => refetchActor()}
                  className="text-destructive font-semibold underline hover:no-underline"
                  data-ocid="create.retry.button"
                >
                  Retry
                </button>
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

            {hasBackendError && (
              <div
                className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive flex items-center justify-between gap-2"
                data-ocid="join.error_state"
              >
                <span>Backend connection failed.</span>
                <button
                  type="button"
                  onClick={() => refetchActor()}
                  className="text-destructive font-semibold underline hover:no-underline"
                  data-ocid="join.retry.button"
                >
                  Retry
                </button>
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Copy className="w-3 h-3" />
              <span>Share your room code to invite friends</span>
            </div>
            {/* Library button */}
            <button
              type="button"
              onClick={() => setShowLibraryPrompt(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/30 bg-gold/5 text-gold text-xs font-medium hover:bg-gold/15 hover:border-gold/60 transition-all"
              data-ocid="library.open_modal_button"
            >
              <Library className="w-3.5 h-3.5" />
              Library
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
