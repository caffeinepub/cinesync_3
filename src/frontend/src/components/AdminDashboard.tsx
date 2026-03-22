import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check,
  Film,
  Library,
  Link2,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useStorageClient } from "../hooks/useStorageClient";

interface AdminDashboardProps {
  roomCode: string;
  onClose: () => void;
  onVideoSourceChange: (src: string) => void;
  onForceSyncAll: () => void;
}

export default function AdminDashboard({
  roomCode,
  onClose,
  onVideoSourceChange,
  onForceSyncAll,
}: AdminDashboardProps) {
  const { actor } = useActor();
  const storageClient = useStorageClient();
  const [urlValue, setUrlValue] = useState("");
  const [applying, setApplying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Library tab state
  const [library, setLibrary] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);

  const fetchLibrary = async () => {
    if (!actor) return;
    setLibraryLoading(true);
    try {
      const items = await (actor as any).getLibrary();
      setLibrary(items);
    } catch {
      toast.error("Failed to load library");
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleLoadFromLibrary = async (item: any) => {
    if (!actor) return;
    const slotNum = Number(item.slot);
    setLoadingSlot(slotNum);
    try {
      await actor.setVideoSource({ roomCode, videoSource: item.videoUrl });
      onVideoSourceChange(item.videoUrl);
      toast.success(`Loaded "${item.videoName}" from library!`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load video");
    } finally {
      setLoadingSlot(null);
    }
  };

  const handleApplyUrl = async () => {
    const url = urlValue.trim();
    if (!url || !actor) return;
    setApplying(true);
    try {
      await actor.setVideoSource({ roomCode, videoSource: url });
      onVideoSourceChange(url);
      toast.success("Video source updated for all viewers!");
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to set video source",
      );
    } finally {
      setApplying(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actor || !storageClient) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { hash } = await storageClient.putFile(bytes, (pct) => {
        setUploadProgress(pct);
      });
      const realUrl = await storageClient.getDirectURL(hash);
      await actor.setVideoSource({ roomCode, videoSource: realUrl });
      onVideoSourceChange(realUrl);
      toast.success("Video uploaded and set as source for all viewers!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await onForceSyncAll();
      toast.success("Force synced all viewers!");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-md rounded-xl"
        data-ocid="admin.modal"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-sm mx-4 rounded-xl border border-gold/30 bg-card shadow-panel overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Admin Dashboard
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Host controls — update video for all
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              data-ocid="admin.close.button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <Tabs defaultValue="url">
              <TabsList className="w-full bg-secondary border border-border mb-4">
                <TabsTrigger
                  value="url"
                  className="flex-1 text-xs"
                  data-ocid="admin.url.tab"
                >
                  <Link2 className="w-3.5 h-3.5 mr-1.5" />
                  Paste URL
                </TabsTrigger>
                <TabsTrigger
                  value="upload"
                  className="flex-1 text-xs"
                  data-ocid="admin.upload.tab"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger
                  value="library"
                  className="flex-1 text-xs"
                  data-ocid="admin.library.tab"
                  onClick={fetchLibrary}
                >
                  <Library className="w-3.5 h-3.5 mr-1.5" />
                  Library
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-3">
                <Input
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyUrl()}
                  placeholder="https://... MP4, MKV, or HLS (.m3u8)"
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-sm h-10"
                  data-ocid="admin.url.input"
                />
                <Button
                  onClick={handleApplyUrl}
                  disabled={!urlValue.trim() || applying}
                  className="w-full bg-gold text-background hover:bg-gold/90 font-semibold h-10"
                  data-ocid="admin.apply_url.button"
                >
                  {applying ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {applying ? "Applying..." : "Apply to All Viewers"}
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="space-y-3">
                <label
                  htmlFor="video-file-upload"
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-gold/40 cursor-pointer transition-colors bg-secondary/50"
                  data-ocid="admin.dropzone"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-foreground font-medium">
                      Choose video file
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      MP4, MKV, MOV, WebM supported
                    </p>
                  </div>
                  <input
                    id="video-file-upload"
                    type="file"
                    accept="video/*,.mkv,video/x-matroska"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading || !storageClient}
                    data-ocid="admin.upload.button"
                  />
                </label>

                {!storageClient && (
                  <p className="text-xs text-muted-foreground text-center">
                    Storage initializing...
                  </p>
                )}

                {uploadProgress !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Uploading to network...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-gold h-1.5 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                        data-ocid="admin.upload.loading_state"
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="library" className="space-y-3">
                {libraryLoading ? (
                  <div
                    className="flex items-center justify-center py-6"
                    data-ocid="admin.library.loading_state"
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-gold" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[0, 1].map((slotIndex) => {
                      const item = library.find(
                        (i) => Number(i.slot) === slotIndex,
                      );
                      const isLoading = loadingSlot === slotIndex;

                      return (
                        <div
                          key={slotIndex}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/40"
                          data-ocid={`admin.library.item.${slotIndex + 1}`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
                            <Film className="w-3.5 h-3.5 text-gold" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gold uppercase tracking-wider">
                              Slot {slotIndex + 1}
                            </p>
                            {item ? (
                              <p className="text-xs text-foreground truncate">
                                {item.videoName}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                Empty slot
                              </p>
                            )}
                          </div>
                          {item && (
                            <Button
                              size="sm"
                              onClick={() => handleLoadFromLibrary(item)}
                              disabled={isLoading}
                              className="bg-gold text-background hover:bg-gold/90 font-semibold h-7 px-3 text-xs flex-shrink-0"
                              data-ocid={`admin.library.button.${slotIndex + 1}`}
                            >
                              {isLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Load"
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="pt-1 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2.5">
                Override playback state for ALL viewers
              </p>
              <Button
                onClick={handleForceSync}
                disabled={syncing}
                className="w-full bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 font-semibold h-10 transition-colors"
                data-ocid="admin.force_sync.button"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {syncing ? "Syncing..." : "Force Sync All Viewers"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
