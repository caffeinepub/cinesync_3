import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Crown } from "lucide-react";

interface ParticipantsListProps {
  participants: string[];
  hostNickname: string;
  currentNickname: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ParticipantsList({
  participants,
  hostNickname,
  currentNickname,
}: ParticipantsListProps) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      data-ocid="participants.panel"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Participants
        </span>
        <span className="text-xs text-muted-foreground">
          {participants.length} online
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {participants.length === 0 ? (
          <div
            className="text-xs text-muted-foreground py-2"
            data-ocid="participants.empty_state"
          >
            No participants yet
          </div>
        ) : (
          participants.map((p, i) => (
            <div
              key={p}
              className="flex items-center gap-2.5"
              data-ocid={`participants.item.${i + 1}`}
            >
              <div className="relative">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="bg-secondary text-xs font-medium text-foreground">
                    {getInitials(p)}
                  </AvatarFallback>
                </Avatar>
                {/* Online dot */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card"
                  style={{ backgroundColor: "oklch(var(--status-green))" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground truncate">
                    {p}
                    {p === currentNickname && (
                      <span className="text-muted-foreground ml-1">(you)</span>
                    )}
                  </span>
                  {p === hostNickname && (
                    <Crown className="w-3 h-3 text-gold shrink-0" />
                  )}
                </div>
                <p className="text-xs text-status-green">Synced</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
