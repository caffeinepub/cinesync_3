import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "../backend";
import { useActor } from "../hooks/useActor";

interface ChatPanelProps {
  messages: ChatMessage[];
  roomCode: string;
  nickname: string;
  isHost: boolean;
  onAdminUnlock?: () => void;
  className?: string;
}

function formatTimestamp(ts: bigint): string {
  // Motoko Time is in nanoseconds
  const ms = Number(ts / BigInt(1_000_000));
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-gold/20 text-gold",
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-green-500/20 text-green-400",
  "bg-rose-500/20 text-rose-400",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ChatPanel({
  messages,
  roomCode,
  nickname,
  isHost,
  onAdminUnlock,
  className,
}: ChatPanelProps) {
  const { actor } = useActor();
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Admin unlock trigger
    if (val === "121219" && isHost) {
      setInputValue("");
      onAdminUnlock?.();
      return;
    }
    setInputValue(val);
  };

  const handleSend = async () => {
    const msg = inputValue.trim();
    if (!msg || !actor || sending) return;
    // Double-check not sending admin code
    if (msg === "121219") {
      setInputValue("");
      return;
    }
    setSending(true);
    try {
      await actor.sendChatMessage({ roomCode, nickname, message: msg });
      setInputValue("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-card/90 backdrop-blur-sm border border-border rounded-xl overflow-hidden ${
        className ?? ""
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Room Chat
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {messages.length} messages
        </span>
      </div>

      {/* Message list */}
      <ScrollArea className="flex-1 px-3">
        <div className="py-3 flex flex-col gap-3">
          {messages.length === 0 ? (
            <div
              className="text-center text-xs text-muted-foreground py-8"
              data-ocid="chat.empty_state"
            >
              No messages yet. Say hello!
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={`${msg.sender}-${String(msg.timestamp)}-${i}`}
                className="flex items-start gap-2.5"
                data-ocid={`chat.item.${i + 1}`}
              >
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarFallback
                    className={`text-xs font-medium ${avatarColor(msg.sender)}`}
                  >
                    {getInitials(msg.sender)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {msg.sender}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 break-words">
                    {msg.message}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="px-3 py-3 border-t border-border flex gap-2 shrink-0">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground text-sm h-9"
          data-ocid="chat.input"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!inputValue.trim() || sending}
          className="h-9 w-9 p-0 bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 transition-colors"
          data-ocid="chat.send.button"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
