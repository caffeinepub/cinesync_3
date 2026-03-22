import Map "mo:core/Map";
import Set "mo:core/Set";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import MixinStorage "blob-storage/Mixin";



actor {
  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  include MixinStorage();

  // User Profile Management
  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Legacy stable variable retained for upgrade compatibility (library feature removed)
  public type LibraryItem = {
    slot : Nat;
    videoUrl : Text;
    videoName : Text;
    uploadedAt : Time.Time;
  };
  let librarySlots = Map.empty<Nat, LibraryItem>();

  // Room Types
  type ChatMessage = {
    sender : Text;
    message : Text;
    timestamp : Time.Time;
  };

  public type RoomState = {
    creator : Principal;
    hostNickname : Text;
    videoSource : Text;
    position : Float;
    isPlaying : Bool;
    lastUpdated : Time.Time;
    participants : [Text];
    chatMessages : [ChatMessage];
    syncVersion : Nat;
  };

  type Room = {
    roomCode : Text;
    creator : Principal;
    hostNickname : Text;
    videoSource : Text;
    position : Float;
    isPlaying : Bool;
    lastUpdated : Time.Time;
    participants : Set.Set<Text>;
    chatMessages : [ChatMessage];
    syncVersion : Nat;
  };

  public type CreateRoomRequest = {
    roomCode : Text;
    hostNickname : Text;
  };

  let rooms = Map.empty<Text, Room>();

  // Room Management Functions
  public shared ({ caller }) func createRoom(request : CreateRoomRequest) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can create rooms");
    };
    if (rooms.containsKey(request.roomCode)) {
      Runtime.trap("Room already exists with code: " # request.roomCode);
    };
    let room : Room = {
      roomCode = request.roomCode;
      creator = caller;
      hostNickname = request.hostNickname;
      videoSource = "";
      position = 0.0;
      isPlaying = false;
      lastUpdated = Time.now();
      participants = Set.singleton(request.hostNickname);
      chatMessages = [];
      syncVersion = 1;
    };
    rooms.add(request.roomCode, room);
  };

  public shared ({ caller }) func deleteRoom(roomCode : Text) : async () {
    let room = getRoomInternal(roomCode);
    if (caller != room.creator) {
      Runtime.trap("Unauthorized: Only the creator can delete the room");
    };
    rooms.remove(roomCode);
  };

  public shared ({ caller }) func joinRoom(roomCode : Text, nickname : Text) : async RoomState {
    let room = getRoomInternal(roomCode);
    if (room.participants.contains(nickname)) {
      Runtime.trap("Nickname already taken in this room");
    };
    room.participants.add(nickname);
    let newParticipants = room.participants.toArray();
    let updatedRoom : Room = {
      roomCode = room.roomCode;
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = room.videoSource;
      position = room.position;
      isPlaying = room.isPlaying;
      lastUpdated = Time.now();
      participants = room.participants;
      chatMessages = room.chatMessages;
      syncVersion = room.syncVersion;
    };
    rooms.add(roomCode, updatedRoom);
    {
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = room.videoSource;
      position = room.position;
      isPlaying = room.isPlaying;
      lastUpdated = room.lastUpdated;
      participants = newParticipants;
      chatMessages = room.chatMessages;
      syncVersion = room.syncVersion;
    };
  };

  public shared ({ caller }) func leaveRoom(request : { roomCode : Text; nickname : Text }) : async () {
    let room = getRoomInternal(request.roomCode);
    if (not room.participants.contains(request.nickname)) {
      Runtime.trap("Not a member of this room");
    };
    room.participants.remove(request.nickname);
    let updatedRoom : Room = {
      roomCode = room.roomCode;
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = room.videoSource;
      position = room.position;
      isPlaying = room.isPlaying;
      lastUpdated = Time.now();
      participants = room.participants;
      chatMessages = room.chatMessages;
      syncVersion = room.syncVersion;
    };
    rooms.add(request.roomCode, updatedRoom);
  };

  // Playback Sync Functions (Host-only)
  public shared ({ caller }) func updatePlaybackState(request : {
    roomCode : Text;
    position : Float;
    isPlaying : Bool;
  }) : async () {
    let room = getRoomInternal(request.roomCode);
    if (caller != room.creator) {
      Runtime.trap("Unauthorized: Only the room creator can update playback state");
    };
    let updatedRoom : Room = {
      roomCode = room.roomCode;
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = room.videoSource;
      position = request.position;
      isPlaying = request.isPlaying;
      lastUpdated = Time.now();
      participants = room.participants;
      chatMessages = room.chatMessages;
      syncVersion = room.syncVersion;
    };
    rooms.add(request.roomCode, updatedRoom);
  };

  public shared ({ caller }) func setVideoSource(request : {
    roomCode : Text;
    videoSource : Text;
  }) : async () {
    let room = getRoomInternal(request.roomCode);
    if (caller != room.creator) {
      Runtime.trap("Unauthorized: Only the room creator can set the video source");
    };
    let updatedRoom : Room = {
      roomCode = room.roomCode;
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = request.videoSource;
      position = 0.0;
      isPlaying = false;
      lastUpdated = Time.now();
      participants = room.participants;
      chatMessages = room.chatMessages;
      syncVersion = room.syncVersion;
    };
    rooms.add(request.roomCode, updatedRoom);
  };

  public shared ({ caller }) func forceSyncAll(request : {
    roomCode : Text;
    position : Float;
    isPlaying : Bool;
  }) : async Nat {
    let room = getRoomInternal(request.roomCode);
    if (caller != room.creator) {
      Runtime.trap("Unauthorized: Only the room creator can force sync");
    };
    let updatedRoom : Room = {
      roomCode = room.roomCode;
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = room.videoSource;
      position = request.position;
      isPlaying = request.isPlaying;
      lastUpdated = Time.now();
      participants = room.participants;
      chatMessages = room.chatMessages;
      syncVersion = room.syncVersion + 1;
    };
    rooms.add(request.roomCode, updatedRoom);
    updatedRoom.syncVersion;
  };

  // Chat Functions
  public shared ({ caller }) func sendChatMessage(request : {
    roomCode : Text;
    nickname : Text;
    message : Text;
  }) : async () {
    let room = getRoomInternal(request.roomCode);
    let sender = if (request.nickname == "") {
      room.hostNickname;
    } else { request.nickname };
    let newMessage : ChatMessage = {
      sender;
      message = request.message;
      timestamp = Time.now();
    };
    let updatedMessages = room.chatMessages.concat([newMessage]);
    let updatedRoom : Room = {
      roomCode = room.roomCode;
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = room.videoSource;
      position = room.position;
      isPlaying = room.isPlaying;
      lastUpdated = room.lastUpdated;
      participants = room.participants;
      chatMessages = updatedMessages;
      syncVersion = room.syncVersion;
    };
    rooms.add(request.roomCode, updatedRoom);
  };

  // Query Functions
  public query ({ caller }) func getChatMessages(roomCode : Text) : async [ChatMessage] {
    let room = getRoomInternal(roomCode);
    room.chatMessages;
  };

  public query ({ caller }) func getRoomState(roomCode : Text) : async RoomState {
    let room = getRoomInternal(roomCode);
    {
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = room.videoSource;
      position = room.position;
      isPlaying = room.isPlaying;
      lastUpdated = room.lastUpdated;
      participants = room.participants.toArray();
      chatMessages = room.chatMessages;
      syncVersion = room.syncVersion;
    };
  };

  public query ({ caller }) func getAllRoomStates() : async [RoomState] {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view all rooms");
    };
    rooms.values().toArray().map(func(room) { toRoomState(room) });
  };

  public query ({ caller }) func getAllParticipants(roomCode : Text) : async [Text] {
    let room = getRoomInternal(roomCode);
    room.participants.toArray();
  };

  public query ({ caller }) func getSyncVersion(roomCode : Text) : async Nat {
    let room = getRoomInternal(roomCode);
    room.syncVersion;
  };

  // Internal Helper Functions
  func getRoomInternal(roomCode : Text) : Room {
    switch (rooms.get(roomCode)) {
      case (null) {
        Runtime.trap("Room does not exist: " # roomCode);
      };
      case (?room) { room };
    };
  };

  func toRoomState(room : Room) : RoomState {
    {
      creator = room.creator;
      hostNickname = room.hostNickname;
      videoSource = room.videoSource;
      position = room.position;
      isPlaying = room.isPlaying;
      lastUpdated = room.lastUpdated;
      participants = room.participants.toArray();
      chatMessages = room.chatMessages;
      syncVersion = room.syncVersion;
    };
  };
};
