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
 * Resolves the effective permissions for a participant in a given room.
 */
export function resolveEffectivePermissions(
  role: string,
  participantId?: string,
  config?: RoomPermissionsConfig
): Set<RoomPermission> {
  // If participant override exists, it takes highest precedence
  if (participantId && config?.participantOverrides?.[participantId]) {
    return new Set(config.participantOverrides[participantId]);
  }

  // Next check custom role permissions defined for the room
  const rolePerms = config?.roles?.[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
  const effective = new Set<RoomPermission>(rolePerms);

  // If host, global locks do not apply
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
