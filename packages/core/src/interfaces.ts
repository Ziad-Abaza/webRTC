import {
  Room,
  Participant,
  Recording,
  ChatMessage,
  BreakoutRoom,
  LiveBroadcastConfig,
  MediaTokenResult,
  RoomInvitation
} from './types.js';

/**
 * Pluggable Media / SFU Provider Interface.
 * Allows seamless switching between Jitsi Meet, Mediasoup, LiveKit, or custom SFU bridges.
 */
export interface IMediaProvider {
  readonly name: string;

  /**
   * Generates authentication credentials/JWT for client to connect to media session.
   */
  generateSessionToken(
    room: Room,
    participant: Participant,
    options?: Record<string, unknown>
  ): Promise<MediaTokenResult>;

  /**
   * Starts a recording session with the media provider.
   */
  startRecording(
    roomId: string,
    options?: { rtmpStreamKey?: string; storageDestination?: string }
  ): Promise<{ recordingId: string; status: string }>;

  /**
   * Stops an active recording session.
   */
  stopRecording(
    roomId: string,
    recordingId: string
  ): Promise<{ success: boolean }>;

  /**
   * Starts RTMP / Live broadcasting stream.
   */
  startBroadcast(
    roomId: string,
    streamUrl: string,
    streamKey: string
  ): Promise<{ broadcastId: string; status: string }>;

  /**
   * Stops live broadcasting stream.
   */
  stopBroadcast(
    roomId: string,
    broadcastId: string
  ): Promise<{ success: boolean }>;

  /**
   * Kicks or mutes participant at the SFU level if supported.
   */
  moderateParticipant?(
    roomId: string,
    participantId: string,
    action: 'mute-audio' | 'mute-video' | 'kick'
  ): Promise<{ success: boolean }>;
}

/**
 * Pluggable Storage Provider Interface for recordings, chat archives, and exported media.
 */
export interface IStorageProvider {
  readonly name: string;

  upload(
    key: string,
    content: Buffer | Uint8Array,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<{ url: string; sizeBytes: number }>;

  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;

  delete(key: string): Promise<boolean>;

  exists(key: string): Promise<boolean>;
}

/**
 * Pluggable Database / State Persistence Adapter.
 * Allows WebRTC to run completely in-memory, on SQLite, or on Postgres/MySQL.
 */
export interface IDatabaseAdapter {
  init(): Promise<void>;
  close(): Promise<void>;

  // Room operations
  createRoom(room: Room): Promise<Room>;
  getRoomById(id: string): Promise<Room | null>;
  getRoomBySlug(slug: string): Promise<Room | null>;
  updateRoom(id: string, updates: Partial<Room>): Promise<Room>;
  deleteRoom(id: string): Promise<boolean>;
  listRooms(filter?: { status?: string; limit?: number; offset?: number }): Promise<Room[]>;

  // Participant operations
  addParticipant(roomId: string, participant: Participant): Promise<Participant>;
  getParticipant(roomId: string, participantId: string): Promise<Participant | null>;
  listParticipants(roomId: string): Promise<Participant[]>;
  updateParticipant(roomId: string, participantId: string, updates: Partial<Participant>): Promise<Participant>;
  removeParticipant(roomId: string, participantId: string): Promise<boolean>;

  // Chat operations
  saveChatMessage(message: ChatMessage): Promise<ChatMessage>;
  getChatHistory(roomId: string, options?: { limit?: number; before?: number }): Promise<ChatMessage[]>;

  // Recording operations
  saveRecording(recording: Recording): Promise<Recording>;
  getRecording(id: string): Promise<Recording | null>;
  listRecordings(roomId?: string): Promise<Recording[]>;
  updateRecording(id: string, updates: Partial<Recording>): Promise<Recording>;

  // Breakout Rooms operations
  createBreakoutRoom(breakout: BreakoutRoom): Promise<BreakoutRoom>;
  getBreakoutRoom(id: string): Promise<BreakoutRoom | null>;
  listBreakoutRooms(parentRoomId: string): Promise<BreakoutRoom[]>;
  updateBreakoutRoom(id: string, updates: Partial<BreakoutRoom>): Promise<BreakoutRoom>;
  deleteBreakoutRoom(id: string): Promise<boolean>;

  // Broadcast operations
  saveBroadcastConfig(config: LiveBroadcastConfig): Promise<LiveBroadcastConfig>;
  getBroadcastConfig(roomId: string): Promise<LiveBroadcastConfig | null>;

  // Invitation operations
  createInvitation(invitation: RoomInvitation): Promise<RoomInvitation>;
  getInvitationByCode(code: string): Promise<RoomInvitation | null>;
  getInvitationById(id: string): Promise<RoomInvitation | null>;
  listInvitations(roomId: string): Promise<RoomInvitation[]>;
  updateInvitation(id: string, updates: Partial<RoomInvitation>): Promise<RoomInvitation>;
  revokeInvitation(id: string): Promise<RoomInvitation>;
}
