import { Toaster } from "@/components/ui/sonner";
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
      {page.type === "landing" ? (
        <LandingPage onEnterRoom={handleEnterRoom} />
      ) : (
        <RoomPage
          roomCode={page.roomCode}
          nickname={page.nickname}
          isHostInitial={page.isHost}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
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
