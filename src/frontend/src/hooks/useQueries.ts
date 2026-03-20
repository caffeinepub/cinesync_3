import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatMessage, CreateRoomRequest, RoomState } from "../backend";
import { useActor } from "./useActor";

export function useGetRoomState(roomCode: string, enabled = true) {
  const { actor, isFetching } = useActor();
  return useQuery<RoomState>({
    queryKey: ["roomState", roomCode],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getRoomState(roomCode);
    },
    enabled: !!actor && !isFetching && enabled && !!roomCode,
    refetchInterval: false, // manual polling via useSyncEngine
    retry: false,
  });
}

export function useGetChatMessages(roomCode: string) {
  const { actor, isFetching } = useActor();
  return useQuery<ChatMessage[]>({
    queryKey: ["chatMessages", roomCode],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getChatMessages(roomCode);
    },
    enabled: !!actor && !isFetching && !!roomCode,
    refetchInterval: false,
  });
}

export function useGetParticipants(roomCode: string) {
  const { actor, isFetching } = useActor();
  return useQuery<string[]>({
    queryKey: ["participants", roomCode],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllParticipants(roomCode);
    },
    enabled: !!actor && !isFetching && !!roomCode,
  });
}

export function useCreateRoom() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateRoomRequest) => {
      if (!actor) throw new Error("Not authenticated");
      await actor.createRoom(req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roomState"] });
    },
  });
}

export function useJoinRoom() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      roomCode,
      nickname,
    }: { roomCode: string; nickname: string }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.joinRoom(roomCode, nickname);
    },
  });
}

export function useLeaveRoom() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      roomCode,
      nickname,
    }: { roomCode: string; nickname: string }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.leaveRoom({ roomCode, nickname });
    },
  });
}

export function useSendChatMessage() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      roomCode,
      nickname,
      message,
    }: {
      roomCode: string;
      nickname: string;
      message: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.sendChatMessage({ roomCode, nickname, message });
    },
  });
}

export function useSetVideoSource() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      roomCode,
      videoSource,
    }: { roomCode: string; videoSource: string }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.setVideoSource({ roomCode, videoSource });
    },
  });
}
