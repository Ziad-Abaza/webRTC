import { Participant, ChatMessage, BreakoutRoom, Recording, LiveBroadcastConfig } from './types.js';

/**
 * Standard WebSocket Events between Engine Server and Clients (Web/Flutter/etc).
 */
export enum NexusEvents {
  // Connection / Session
  JOIN = 'nexus:join',
  JOINED = 'nexus:joined',
  LEAVE = 'nexus:leave',
  LEFT = 'nexus:left',
  ERROR = 'nexus:error',

  // Participant Presence & State
  PARTICIPANT_JOINED = 'nexus:participant_joined',
  PARTICIPANT_LEFT = 'nexus:participant_left',
  PARTICIPANT_UPDATED = 'nexus:participant_updated',

  // Media & Controls
  MEDIA_STATE_CHANGED = 'nexus:media_state_changed',
  SCREEN_SHARE_STARTED = 'nexus:screen_share_started',
  SCREEN_SHARE_STOPPED = 'nexus:screen_share_stopped',

  // Raise Hand
  HAND_RAISED = 'nexus:hand_raised',
  HAND_LOWERED = 'nexus:hand_lowered',

  // Moderation
  MODERATE_PARTICIPANT = 'nexus:moderate_participant',
  PARTICIPANT_MODERATED = 'nexus:participant_moderated',
  ROOM_MUTED_ALL = 'nexus:room_muted_all',

  // Chat
  CHAT_SEND = 'nexus:chat_send',
  CHAT_RECEIVED = 'nexus:chat_received',

  // Recording
  RECORDING_START = 'nexus:recording_start',
  RECORDING_STOP = 'nexus:recording_stop',
  RECORDING_STATE_CHANGED = 'nexus:recording_state_changed',

  // Breakout Rooms
  BREAKOUT_CREATE = 'nexus:breakout_create',
  BREAKOUT_CREATED = 'nexus:breakout_created',
  BREAKOUT_JOIN = 'nexus:breakout_join',
  BREAKOUT_LEAVE = 'nexus:breakout_leave',
  BREAKOUT_UPDATED = 'nexus:breakout_updated',
  BREAKOUT_BROADCAST = 'nexus:breakout_broadcast', // host announcement to all sub-rooms
  BREAKOUT_CLOSED = 'nexus:breakout_closed',

  // Live Broadcast
  BROADCAST_START = 'nexus:broadcast_start',
  BROADCAST_STOP = 'nexus:broadcast_stop',
  BROADCAST_STATE_CHANGED = 'nexus:broadcast_state_changed'
}

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
