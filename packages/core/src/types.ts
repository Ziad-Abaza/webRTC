import { RoomPermissionsConfig, RoomPermission } from './permissions.js';

export type ParticipantRole = 'host' | 'moderator' | 'participant' | 'viewer' | string;

export interface Participant {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role: ParticipantRole;
  joinedAt: number;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  handRaisedAt?: number;
  permissions?: RoomPermission[];
  metadata?: Record<string, unknown>;
  currentBreakoutRoomId?: string | null;
}

export type RoomStatus = 'active' | 'closed' | 'scheduled';

export interface RoomFeatures {
  recordingEnabled: boolean;
  chatEnabled: boolean;
  screenShareEnabled: boolean;
  breakoutRoomsEnabled: boolean;
  raiseHandEnabled: boolean;
  liveStreamingEnabled: boolean;
  waitingRoomEnabled: boolean;
  maxParticipants?: number;
}

export interface Room {
  id: string; // Internal unique ID / UUID
  slug: string; // Human-friendly or unique room code / alias
  title: string;
  description?: string;
  status: RoomStatus;
  password?: string;
  hostId: string;
  hostKey?: string; // Secret key for authoritative host actions and token verification
  features: RoomFeatures;
  permissions?: RoomPermissionsConfig;
  mediaProvider: string; // e.g. 'jitsi', 'native-sfu'
  mediaConfig: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface BreakoutRoom {
  id: string;
  parentRoomId: string;
  name: string;
  participantIds: string[];
  createdAt: number;
  durationMinutes?: number;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: ParticipantRole;
  content: string;
  timestamp: number;
  isPrivate?: boolean;
  recipientId?: string; // If private message
}

export type RecordingStatus = 'starting' | 'recording' | 'stopping' | 'processing' | 'completed' | 'failed';

export interface Recording {
  id: string;
  roomId: string;
  status: RecordingStatus;
  startedAt: number;
  stoppedAt?: number;
  durationSeconds?: number;
  fileSizeBytes?: number;
  fileUrl?: string;
  storageKey?: string;
  downloadUrl?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export type BroadcastStatus = 'idle' | 'live' | 'stopped' | 'error';

export interface LiveBroadcastConfig {
  id: string;
  roomId: string;
  streamUrl: string; // RTMP URL
  streamKey: string;
  status: BroadcastStatus;
  viewerUrl?: string; // HLS or low-latency viewer stream link
  startedAt?: number;
  stoppedAt?: number;
  error?: string;
}

export interface AuthTokenPayload {
  sub: string; // participant ID
  name: string;
  email?: string;
  roomId: string;
  roomSlug: string;
  role: ParticipantRole;
  exp: number;
  iat: number;
  metadata?: Record<string, unknown>;
}

export interface MediaTokenResult {
  token: string;
  room: string;
  domain: string;
  appId?: string;
}
