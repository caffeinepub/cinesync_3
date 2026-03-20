import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface RoomState {
    creator: Principal;
    participants: Array<string>;
    chatMessages: Array<ChatMessage>;
    lastUpdated: Time;
    hostNickname: string;
    isPlaying: boolean;
    videoSource: string;
    position: number;
}
export type Time = bigint;
export interface CreateRoomRequest {
    hostNickname: string;
    roomCode: string;
}
export interface ChatMessage {
    sender: string;
    message: string;
    timestamp: Time;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createRoom(request: CreateRoomRequest): Promise<void>;
    deleteRoom(roomCode: string): Promise<void>;
    getAllParticipants(roomCode: string): Promise<Array<string>>;
    getAllRoomStates(): Promise<Array<RoomState>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getChatMessages(roomCode: string): Promise<Array<ChatMessage>>;
    getRoomState(roomCode: string): Promise<RoomState>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    joinRoom(roomCode: string, nickname: string): Promise<RoomState>;
    leaveRoom(request: {
        nickname: string;
        roomCode: string;
    }): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendChatMessage(request: {
        nickname: string;
        message: string;
        roomCode: string;
    }): Promise<void>;
    setVideoSource(request: {
        videoSource: string;
        roomCode: string;
    }): Promise<void>;
    updatePlaybackState(request: {
        isPlaying: boolean;
        position: number;
        roomCode: string;
    }): Promise<void>;
}
