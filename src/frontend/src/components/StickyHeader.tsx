import { Button } from "@/components/ui/button";
import { Check, Copy, Film, LogOut, Users, Wifi } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface StickyHeaderProps {
  roomCode: string;
  participantCount: number;
  isSynced: boolean;
  onLeave: () => void;
}

export default function StickyHeader({
  roomCode,
  participantCount,
  isSynced,
  onLeave,
}: StickyHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success("Room code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-1.5 mr-2">
          <Film className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-foreground hidden sm:block">
            Cine<span className="text-gold">Sync</span>
          </span>
        </div>

        {/* Room code */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border">
          <span className="text-xs text-muted-foreground uppercase tracking-widest hidden sm:block">
            Room:
          </span>
          <span className="text-xs font-mono font-semibold text-foreground">
            {roomCode.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-gold transition-colors"
            title="Copy room code"
            data-ocid="header.copy_code.button"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-status-green" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sync status */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: isSynced
                ? "oklch(var(--status-green))"
                : "oklch(var(--status-yellow))",
              boxShadow: isSynced
                ? "0 0 6px oklch(var(--status-green) / 0.6)"
                : "0 0 6px oklch(var(--status-yellow) / 0.6)",
            }}
          />
          <span className="text-xs text-muted-foreground hidden sm:block">
            {isSynced ? "Synced" : "Syncing"}
          </span>
        </div>

        {/* Participants */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-foreground font-medium">
            {participantCount}
          </span>
        </div>

        {/* Wi-Fi indicator */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-status-green" />
        </div>

        {/* Leave */}
        <Button
          size="sm"
          variant="outline"
          onClick={onLeave}
          className="h-8 text-xs border-border bg-secondary text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
          data-ocid="header.leave.button"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Leave
        </Button>
      </div>
    </header>
  );
}
