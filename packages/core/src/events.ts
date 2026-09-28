import { Participant, ChatMessage, BreakoutRoom, Recording, LiveBroadcastConfig } from './types.js';

/**
 * Standard WebSocket Events between Engine Server and Clients (Web/Flutter/etc).
 */
export enum WebRTCEvents {
  // Connection / Session
  JOIN = 'webrtc:join',
  JOINED = 'webrtc:joined',
  LEAVE = 'webrtc:leave',
  LEFT = 'webrtc:left',
  ERROR = 'webrtc:error',

  // Participant Presence & State
  PARTICIPANT_JOINED = 'webrtc:participant_joined',
  PARTICIPANT_LEFT = 'webrtc:participant_left',
  PARTICIPANT_UPDATED = 'webrtc:participant_updated',

  // Media & Controls
  MEDIA_STATE_CHANGED = 'webrtc:media_state_changed',
  SCREEN_SHARE_STARTED = 'webrtc:screen_share_started',
  SCREEN_SHARE_STOPPED = 'webrtc:screen_share_stopped',

  // Raise Hand
  HAND_RAISED = 'webrtc:hand_raised',
  HAND_LOWERED = 'webrtc:hand_lowered',

  // Moderation & Permissions
  MODERATE_PARTICIPANT = 'webrtc:moderate_participant',
  PARTICIPANT_MODERATED = 'webrtc:participant_moderated',
  ROOM_MUTED_ALL = 'webrtc:room_muted_all',
  UPDATE_PERMISSIONS = 'webrtc:update_permissions',
  PERMISSIONS_UPDATED = 'webrtc:permissions_updated',
  LOCKS_CHANGED = 'webrtc:locks_changed',

  // Chat
  CHAT_SEND = 'webrtc:chat_send',
  CHAT_RECEIVED = 'webrtc:chat_received',

  // Recording
  RECORDING_START = 'webrtc:recording_start',
  RECORDING_STOP = 'webrtc:recording_stop',
  RECORDING_STATE_CHANGED = 'webrtc:recording_state_changed',

  // Breakout Rooms
  BREAKOUT_CREATE = 'webrtc:breakout_create',
  BREAKOUT_CREATED = 'webrtc:breakout_created',
  BREAKOUT_JOIN = 'webrtc:breakout_join',
  BREAKOUT_LEAVE = 'webrtc:breakout_leave',
  BREAKOUT_UPDATED = 'webrtc:breakout_updated',
  BREAKOUT_BROADCAST = 'webrtc:breakout_broadcast', // host announcement to all sub-rooms
  BREAKOUT_CLOSED = 'webrtc:breakout_closed',

  // Live Broadcast
  BROADCAST_START = 'webrtc:broadcast_start',
  BROADCAST_STOP = 'webrtc:broadcast_stop',
  BROADCAST_STATE_CHANGED = 'webrtc:broadcast_state_changed'
}

export { WebRTCEvents as NexusEvents };

export interface JoinPayload {
  token: string;
  clientInfo?: {
    userAgent?: string;
    platform?: 'web' | 'mobile' | 'desktop';
  };
}

export interface JoinedResponse {
  room: {
    id: string;
    slug: string;
    title: string;
    features: Record<string, unknown>;
  };
  self: Participant;
  participants: Participant[];
  media: {
    provider: string;
    token: string;
    domain: string;
    room: string;
    appId?: string;
  };
  activeBreakoutRooms?: BreakoutRoom[];
  activeRecording?: Recording | null;
  activeBroadcast?: LiveBroadcastConfig | null;
}
