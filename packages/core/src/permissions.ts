/**
 * Granular Session Capabilities / Permissions.
 *
 * Defines explicit permissions that can be granted or restricted per role,
 * per room, or per individual participant.
 */
export enum RoomPermission {
  // Media Capabilities
  SEND_AUDIO = 'media:send_audio',
  SEND_VIDEO = 'media:send_video',
  SHARE_SCREEN = 'media:share_screen',

  // Interaction Capabilities
  SEND_CHAT = 'chat:send',
  SEND_PRIVATE_CHAT = 'chat:send_private',
  RAISE_HAND = 'interaction:raise_hand',

  // Breakout Rooms Capabilities
  CREATE_BREAKOUT = 'breakout:create',
  JOIN_BREAKOUT = 'breakout:join',
  BROADCAST_BREAKOUT = 'breakout:broadcast',

  // Advanced Operations
  START_RECORDING = 'session:start_recording',
  STOP_RECORDING = 'session:stop_recording',
  START_BROADCAST = 'session:start_broadcast',
  STOP_BROADCAST = 'session:stop_broadcast',

  // Moderation & Administrative
  MUTE_OTHERS = 'moderation:mute_others',
  KICK_PARTICIPANTS = 'moderation:kick_participants',
  UPDATE_ROOM_PERMISSIONS = 'session:update_permissions',
  MANAGE_PARTICIPANTS = 'moderation:manage_participants'
}

/**
 * Custom role definition mapping a role name to its granted permissions.
 */
export interface RolePermissions {
  [roleName: string]: RoomPermission[];
}

/**
 * Standard default permissions for built-in roles:
 * - host: Full administrative and session control
 * - moderator: Moderation, breakout management, recording control
 * - participant: Interactive meeting member (audio/video/chat/raise-hand/screen-share)
 * - viewer: Read-only attendee (cannot broadcast media or participate in chat unless granted)
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  host: [
    RoomPermission.SEND_AUDIO,
    RoomPermission.SEND_VIDEO,
    RoomPermission.SHARE_SCREEN,
    RoomPermission.SEND_CHAT,
    RoomPermission.SEND_PRIVATE_CHAT,
    RoomPermission.RAISE_HAND,
    RoomPermission.CREATE_BREAKOUT,
    RoomPermission.JOIN_BREAKOUT,
    RoomPermission.BROADCAST_BREAKOUT,
    RoomPermission.START_RECORDING,
    RoomPermission.STOP_RECORDING,
    RoomPermission.START_BROADCAST,
    RoomPermission.STOP_BROADCAST,
    RoomPermission.MUTE_OTHERS,
    RoomPermission.KICK_PARTICIPANTS,
    RoomPermission.UPDATE_ROOM_PERMISSIONS,
    RoomPermission.MANAGE_PARTICIPANTS
  ],
  moderator: [
    RoomPermission.SEND_AUDIO,
    RoomPermission.SEND_VIDEO,
    RoomPermission.SHARE_SCREEN,
    RoomPermission.SEND_CHAT,
    RoomPermission.SEND_PRIVATE_CHAT,
    RoomPermission.RAISE_HAND,
    RoomPermission.CREATE_BREAKOUT,
    RoomPermission.JOIN_BREAKOUT,
    RoomPermission.BROADCAST_BREAKOUT,
    RoomPermission.START_RECORDING,
    RoomPermission.STOP_RECORDING,
    RoomPermission.MUTE_OTHERS,
    RoomPermission.KICK_PARTICIPANTS,
    RoomPermission.MANAGE_PARTICIPANTS
  ],
  participant: [
    RoomPermission.SEND_AUDIO,
    RoomPermission.SEND_VIDEO,
    RoomPermission.SHARE_SCREEN,
    RoomPermission.SEND_CHAT,
    RoomPermission.SEND_PRIVATE_CHAT,
    RoomPermission.RAISE_HAND,
    RoomPermission.JOIN_BREAKOUT
  ],
  viewer: [
    RoomPermission.RAISE_HAND
  ]
};

/**
 * Room Permissions Configuration allowing the session owner to customize
 * capabilities across all roles or specific participant overrides.
 */
export interface RoomPermissionsConfig {
  /**
   * List of participant IDs banned/evicted from the room
   */
  bannedParticipantIds?: string[];

  /**
   * List of participant IDs issued elevated/privileged roles (host, moderator, custom privileged roles).
   * Untrusted callers without hostKey cannot hijack or impersonate these identities.
   */
  privilegedParticipantIds?: string[];

  /**
   * Overrides or extensions for role-based permissions in this room.
   * e.g. `{ participant: [RoomPermission.SEND_AUDIO, RoomPermission.SEND_CHAT] }` (no video or screenshare)
   */
  roles?: RolePermissions;

  /**
   * Specific participant overrides: participantId -> list of granted permissions
   */
  participantOverrides?: {
    [participantId: string]: RoomPermission[];
  };

  /**
   * Global feature locks enforced across all non-host participants
   * e.g. lockAllMic: true
   */
  locks?: {
    lockMicrophones?: boolean;
    lockCameras?: boolean;
    lockScreenshare?: boolean;
    lockChat?: boolean;
    lockPrivateChat?: boolean;
  };
}

/**
 * Authoritative role hierarchy ranking for moderation decisions.
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  host: 100,
  moderator: 50,
  participant: 10,
  viewer: 1
};

export function getRoleRank(role: string): number {
  return ROLE_HIERARCHY[role] ?? 10;
}

/**
 * Authoritatively verifies whether a caller can moderate (mute/kick) a target.
 * Enforces:
 * 1. Room owner/host has absolute immunity: cannot be kicked or muted by anyone.
 * 2. Self-moderation via moderate action is prohibited.
 * 3. Caller must have strictly higher role rank than target (rank(caller) > rank(target)).
 * 4. Moderators cannot moderate other moderators.
 */
export function canModerateParticipant(
  callerRole: string,
  callerId: string,
  targetRole: string,
  targetId: string,
  roomHostId?: string
): { allowed: boolean; reason?: string } {
  if (callerId === targetId) {
    return { allowed: false, reason: 'Cannot moderate self' };
  }

  // Room Host has absolute immunity from moderation actions
  if (targetRole === 'host' || (roomHostId && targetId === roomHostId)) {
    return { allowed: false, reason: 'Cannot moderate or kick the room host' };
  }

  // Target is a moderator: ONLY the host can moderate moderators
  if (targetRole === 'moderator' && callerRole !== 'host' && (!roomHostId || callerId !== roomHostId)) {
    return { allowed: false, reason: 'Moderators cannot be moderated by peer moderators or participants' };
  }

  const callerRank = getRoleRank(callerRole);
  const targetRank = getRoleRank(targetRole);

  if (callerRank <= targetRank) {
    return { allowed: false, reason: 'Unauthorized to moderate participant with equal or higher role hierarchy' };
  }

  return { allowed: true };
}

/**
 * Resolves the effective permissions for a participant in a given room.
 */
export function resolveEffectivePermissions(
  role: string,
  participantId?: string,
  config?: RoomPermissionsConfig,
  features?: {
    recordingEnabled?: boolean;
    chatEnabled?: boolean;
    screenShareEnabled?: boolean;
    breakoutRoomsEnabled?: boolean;
    raiseHandEnabled?: boolean;
    liveStreamingEnabled?: boolean;
  }
): Set<RoomPermission> {
  // If role is host, host ALWAYS retains base host capabilities.
  // Overrides or custom roles can add capabilities, but CANNOT strip host administrative/moderation powers.
  let rolePerms: RoomPermission[];
  if (role === 'host') {
    const baseHost = DEFAULT_ROLE_PERMISSIONS.host;
    const customHost = config?.roles?.['host'] || [];
    const overrides = (participantId && config?.participantOverrides?.[participantId]) || [];
    rolePerms = Array.from(new Set([...baseHost, ...customHost, ...overrides]));
  } else if (participantId && config?.participantOverrides?.[participantId]) {
    rolePerms = config.participantOverrides[participantId];
  } else {
    rolePerms = config?.roles?.[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
  }
  const effective = new Set<RoomPermission>(rolePerms);

  // Authoritative feature enforcement: if a room feature is disabled,
  // that capability is disabled for all participants including host.
  if (features) {
    if (features.recordingEnabled === false) {
      effective.delete(RoomPermission.START_RECORDING);
      effective.delete(RoomPermission.STOP_RECORDING);
    }
    if (features.breakoutRoomsEnabled === false) {
      effective.delete(RoomPermission.CREATE_BREAKOUT);
      effective.delete(RoomPermission.JOIN_BREAKOUT);
      effective.delete(RoomPermission.BROADCAST_BREAKOUT);
    }
    if (features.chatEnabled === false) {
      effective.delete(RoomPermission.SEND_CHAT);
      effective.delete(RoomPermission.SEND_PRIVATE_CHAT);
    }
    if (features.screenShareEnabled === false) {
      effective.delete(RoomPermission.SHARE_SCREEN);
    }
    if (features.raiseHandEnabled === false) {
      effective.delete(RoomPermission.RAISE_HAND);
    }
    if (features.liveStreamingEnabled === false) {
      effective.delete(RoomPermission.START_BROADCAST);
      effective.delete(RoomPermission.STOP_BROADCAST);
    }
  }

  // If host, global dynamic locks do not apply
  if (role === 'host') {
    return effective;
  }

  // Apply room-level global locks
  if (config?.locks) {
    if (config.locks.lockMicrophones) effective.delete(RoomPermission.SEND_AUDIO);
    if (config.locks.lockCameras) effective.delete(RoomPermission.SEND_VIDEO);
    if (config.locks.lockScreenshare) effective.delete(RoomPermission.SHARE_SCREEN);
    if (config.locks.lockChat) effective.delete(RoomPermission.SEND_CHAT);
    if (config.locks.lockPrivateChat) effective.delete(RoomPermission.SEND_PRIVATE_CHAT);
  }

  return effective;
}
