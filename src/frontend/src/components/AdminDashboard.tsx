import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Link2, Loader2, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useStorageClient } from "../hooks/useStorageClient";

interface AdminDashboardProps {
  roomCode: string;
  onClose: () => void;
  onVideoSourceChange: (src: string) => void;
}

export default function AdminDashboard({
  roomCode,
  onClose,
  onVideoSourceChange,
}: AdminDashboardProps) {
  const { actor } = useActor();
  const storageClient = useStorageClient();
  const [urlValue, setUrlValue] = useState("");
  const [applying, setApplying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

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
          {/* Header */}
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

          {/* Tabs */}
          <div className="p-5">
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
              </TabsList>

              <TabsContent value="url" className="space-y-3">
                <Input
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyUrl()}
                  placeholder="https://... MP4 or HLS (.m3u8)"
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
                      MP4, MOV, WebM supported
                    </p>
                  </div>
                  <input
                    id="video-file-upload"
                    type="file"
                    accept="video/*"
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
            </Tabs>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
