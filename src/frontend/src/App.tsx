import { Toaster } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage";
import RoomPage from "./pages/RoomPage";

type AppPage =
  | { type: "landing" }
  | { type: "room"; roomCode: string; nickname: string; isHost: boolean };

export default function App() {
  const [page, setPage] = useState<AppPage>({ type: "landing" });

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleEnterRoom = (
    roomCode: string,
    nickname: string,
    isHost: boolean,
  ) => {
    setPage({ type: "room", roomCode, nickname, isHost });
  };

  const handleLeaveRoom = () => {
    setPage({ type: "landing" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnimatePresence mode="wait">
        {page.type === "landing" ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <LandingPage onEnterRoom={handleEnterRoom} />
          </motion.div>
        ) : (
          <motion.div
            key="room"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <RoomPage
              roomCode={page.roomCode}
              nickname={page.nickname}
              isHostInitial={page.isHost}
              onLeaveRoom={handleLeaveRoom}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "oklch(0.14 0 0)",
            border: "1px solid oklch(0.20 0 0)",
            color: "oklch(0.94 0 0)",
          },
        }}
      />
    </div>
  );
}
