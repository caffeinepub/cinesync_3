import { ChevronDown, ChevronUp, MessageSquare, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ChatMessage } from "../backend";
import ChatPanel from "./ChatPanel";

interface MobileChatDrawerProps {
  messages: ChatMessage[];
  roomCode: string;
  nickname: string;
  isHost: boolean;
  onAdminUnlock?: () => void;
}

export default function MobileChatDrawer({
  messages,
  roomCode,
  nickname,
  isHost,
  onAdminUnlock,
}: MobileChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        animate={{ y: isOpen ? 0 : "calc(100% - 56px)" }}
        initial={false}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* Handle bar */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="w-full h-14 flex items-center justify-between px-4 bg-card border-t border-border"
          data-ocid="chat.drawer.button"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Chat
              {messages.length > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({messages.length})
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isOpen ? (
              <>
                <X className="w-4 h-4 text-muted-foreground" />
              </>
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Chat content */}
        <div
          className="bg-background/95 backdrop-blur-md"
          style={{ height: "calc(100svh - 56px - 56px)" }}
        >
          <ChatPanel
            messages={messages}
            roomCode={roomCode}
            nickname={nickname}
            isHost={isHost}
            onAdminUnlock={onAdminUnlock}
            className="h-full rounded-none border-x-0 border-b-0"
          />
        </div>
      </motion.div>
    </>
  );
}
