import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  IDatabaseAdapter,
  IMediaProvider,
  Room,
  Participant,
  ParticipantRole,
  AuthTokenPayload,
  MediaTokenResult,
  RoomPermissionsConfig,
  RoomPermission,
  RoomInvitation,
  CreateInvitationInput,
  resolveEffectivePermissions
} from '@nexusrtc/core';
import { ServerConfig } from '../config/index.js';

export interface CreateRoomInput {
  slug?: string;
  title: string;
  description?: string;
  password?: string;
  hostId: string;
  hostKey?: string;
  features?: Partial<Room['features']>;
  permissions?: RoomPermissionsConfig;
  mediaProvider?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerateTokenInput {
  participantId?: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: ParticipantRole;
  hostKey?: string; // Must match room.hostKey to obtain host/moderator privileges
  inviteCode?: string; // If joining through an invitation
  metadata?: Record<string, unknown>;
}

export class RoomService {
  constructor(
    private db: IDatabaseAdapter,
    public mediaProvider: IMediaProvider,
    private config: ServerConfig
  ) {}

  async createRoom(input: CreateRoomInput): Promise<Room> {
    const slug = input.slug
      ? input.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-')
      : `nexus-${uuidv4().substring(0, 8)}`;

    const existing = await this.db.getRoomBySlug(slug);
    if (existing && existing.status === 'active') {
      throw new Error(`Room with slug '${slug}' already exists and is active`);
    }

    const hostKey = input.hostKey || uuidv4();

    const room: Room = {
      id: uuidv4(),
      slug,
      title: input.title,
      description: input.description,
      status: 'active',
      password: input.password,
      hostId: input.hostId,
      hostKey,
      mediaProvider: input.mediaProvider || this.config.defaultMediaProvider,
      mediaConfig: {},
      features: {
        recordingEnabled: input.features?.recordingEnabled ?? true,
        chatEnabled: input.features?.chatEnabled ?? true,
        screenShareEnabled: input.features?.screenShareEnabled ?? true,
        breakoutRoomsEnabled: input.features?.breakoutRoomsEnabled ?? true,
        raiseHandEnabled: input.features?.raiseHandEnabled ?? true,
        liveStreamingEnabled: input.features?.liveStreamingEnabled ?? true,
        waitingRoomEnabled: input.features?.waitingRoomEnabled ?? false,
        maxParticipants: input.features?.maxParticipants ?? 100
      },
      permissions: input.permissions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: input.metadata
    };

    return this.db.createRoom(room);
  }

  async getRoom(idOrSlug: string): Promise<Room | null> {
    let room = await this.db.getRoomById(idOrSlug);
    if (!room) {
      room = await this.db.getRoomBySlug(idOrSlug);
    }
    return room;
  }

  async listRooms(status?: string): Promise<Room[]> {
    return this.db.listRooms(status ? { status } : undefined);
  }

  async closeRoom(id: string): Promise<Room> {
    const room = await this.db.getRoomById(id);
    if (!room) throw new Error(`Room not found`);
    return this.db.updateRoom(id, {
      status: 'closed',
      closedAt: Date.now()
    });
  }

  async updateRoomPermissions(id: string, permissions: RoomPermissionsConfig): Promise<Room> {
    const room = await this.getRoom(id);
    if (!room) throw new Error(`Room '${id}' not found`);
    return this.db.updateRoom(room.id, {
      permissions: {
        ...room.permissions,
        ...permissions,
        bannedParticipantIds: permissions.bannedParticipantIds || room.permissions?.bannedParticipantIds,
        privilegedParticipantIds: permissions.privilegedParticipantIds || room.permissions?.privilegedParticipantIds,
        roles: {
          ...room.permissions?.roles,
          ...permissions.roles
        },
        participantOverrides: {
          ...room.permissions?.participantOverrides,
          ...permissions.participantOverrides
        },
        locks: {
          ...room.permissions?.locks,
          ...permissions.locks
        }
      }
    });
  }

  async banParticipant(roomId: string, participantId: string): Promise<Room> {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error(`Room '${roomId}' not found`);
    const currentBanned = room.permissions?.bannedParticipantIds || [];
    if (!currentBanned.includes(participantId)) {
      return this.updateRoomPermissions(room.id, {
        bannedParticipantIds: [...currentBanned, participantId]
      });
    }
    return room;
  }

  /**
   * Create an authoritative invitation for a room.
   * Invitations are strictly restricted to attendee roles ('participant' or 'viewer').
   */
  async createInvitation(
    roomIdOrSlug: string,
    input: CreateInvitationInput = {},
    createdByParticipantId: string = 'host'
  ): Promise<RoomInvitation> {
    const room = await this.getRoom(roomIdOrSlug);
    if (!room) {
      throw new Error(`Room '${roomIdOrSlug}' not found`);
    }
    if (room.status !== 'active') {
      throw new Error(`Cannot create invitation for inactive or closed room`);
    }

    const requestedRole = input.role || 'participant';
    if (requestedRole !== 'participant' && requestedRole !== 'viewer') {
      throw new Error(`Invalid invitation role '${requestedRole}': invitations may only grant 'participant' or 'viewer' access`);
    }

    const code = crypto.randomBytes(8).toString('hex'); // 16-character secure random hex
    const maxUses = input.maxUses !== undefined && input.maxUses !== null ? Math.max(1, input.maxUses) : null;
    const expiresAt = input.expiresInSeconds && input.expiresInSeconds > 0
      ? Date.now() + input.expiresInSeconds * 1000
      : null;

    const invitation: RoomInvitation = {
      id: uuidv4(),
      code,
      roomId: room.id,
      roomSlug: room.slug,
      role: requestedRole,
      createdBy: createdByParticipantId,
      maxUses,
      usesCount: 0,
      expiresAt,
      status: 'active',
      createdAt: Date.now(),
      metadata: input.metadata
    };

    return this.db.createInvitation(invitation);
  }

  async getInvitation(code: string): Promise<{ invitation: RoomInvitation; room: Room } | null> {
    const invitation = await this.db.getInvitationByCode(code);
    if (!invitation) return null;

    const room = await this.getRoom(invitation.roomId);
    if (!room) return null;

    // Check expiration and auto-mark expired in DB if needed
    if (invitation.expiresAt && Date.now() > invitation.expiresAt && invitation.status === 'active') {
      const updated = await this.db.updateInvitation(invitation.id, { status: 'expired' });
      return { invitation: updated, room };
    }

    // Check max uses
    if (invitation.maxUses && invitation.usesCount >= invitation.maxUses && invitation.status === 'active') {
      const updated = await this.db.updateInvitation(invitation.id, { status: 'expired' });
      return { invitation: updated, room };
    }

    return { invitation, room };
  }

  async listInvitations(roomIdOrSlug: string): Promise<RoomInvitation[]> {
    const room = await this.getRoom(roomIdOrSlug);
    if (!room) throw new Error(`Room '${roomIdOrSlug}' not found`);

    const list = await this.db.listInvitations(room.id);
    const now = Date.now();
    const updatedList: RoomInvitation[] = [];

    for (const inv of list) {
      if (inv.status === 'active' && inv.expiresAt && now > inv.expiresAt) {
        const updated = await this.db.updateInvitation(inv.id, { status: 'expired' });
        updatedList.push(updated);
      } else if (inv.status === 'active' && inv.maxUses && inv.usesCount >= inv.maxUses) {
        const updated = await this.db.updateInvitation(inv.id, { status: 'expired' });
        updatedList.push(updated);
      } else {
        updatedList.push(inv);
      }
    }

    return updatedList;
  }

  async revokeInvitation(codeOrId: string): Promise<RoomInvitation> {
    let inv = await this.db.getInvitationByCode(codeOrId);
    if (!inv) {
      inv = await this.db.getInvitationById(codeOrId);
    }
    if (!inv) {
      throw new Error(`Invitation '${codeOrId}' not found`);
    }
    return this.db.revokeInvitation(inv.id);
  }

  /**
   * Generates a client join token for a participant to connect to the signaling server and media.
   */
  async generateJoinToken(roomIdOrSlug: string, input: GenerateTokenInput): Promise<{
    token: string;
    participant: Participant;
    room: Room;
    media: MediaTokenResult;
  }> {
    const room = await this.getRoom(roomIdOrSlug);
    if (!room) {
      throw new Error(`Room '${roomIdOrSlug}' not found`);
    }
    if (room.status !== 'active') {
      throw new Error(`Room '${room.title}' is closed`);
    }

    // Check if joining with an invitation code
    let activeInvitation: RoomInvitation | null = null;
    if (input.inviteCode) {
      const invLookup = await this.getInvitation(input.inviteCode);
      if (!invLookup) {
        throw new Error('Invalid or non-existent invitation code');
      }
      activeInvitation = invLookup.invitation;
      if (activeInvitation.roomId !== room.id && activeInvitation.roomSlug !== room.slug) {
        throw new Error('Invitation code does not belong to this room');
      }
      if (activeInvitation.status === 'revoked') {
        throw new Error('This invitation has been revoked by the host');
      }
      if (activeInvitation.status === 'expired' || (activeInvitation.expiresAt && Date.now() > activeInvitation.expiresAt)) {
        throw new Error('This invitation has expired');
      }
      if (activeInvitation.maxUses && activeInvitation.usesCount >= activeInvitation.maxUses) {
        throw new Error('This invitation has reached its maximum allowed uses');
      }
    }

    const isHostByKey = Boolean(!activeInvitation && room.hostKey && input.hostKey && input.hostKey === room.hostKey);

    // If participant ID was supplied by a host/admin caller, check if previously evicted
    if (input.participantId && room.permissions?.bannedParticipantIds?.includes(input.participantId)) {
      throw new Error('Participant has been evicted from this session');
    }

    // Authoritative role derivation:
    // If joining via an invitation, the participant role is strictly locked to the invitation's granted role.
    // Privileged roles (host, moderator, or any custom role with elevated privileges)
    // can ONLY be granted if a valid hostKey matching room.hostKey is provided without invitation.
    let role: ParticipantRole = 'participant';
    const requestedRole = input.role || 'participant';

    if (activeInvitation) {
      role = activeInvitation.role;
    } else if (isHostByKey) {
      role = requestedRole;
    } else {
      if (requestedRole === 'viewer') {
        role = 'viewer';
      } else {
        // Any other requested role (host, moderator, admin, co-host, etc.) is strictly demoted to standard participant
        role = 'participant';
      }
    }

    // If invitation was used, increment usage count in database
    if (activeInvitation) {
      const newCount = activeInvitation.usesCount + 1;
      const isNowExpired = Boolean(activeInvitation.maxUses && newCount >= activeInvitation.maxUses);
      await this.db.updateInvitation(activeInvitation.id, {
        usesCount: newCount,
        ...(isNowExpired ? { status: 'expired' } : {})
      });
    }

    let currentRoom = room;

    // If a privileged role is legitimately granted via hostKey, register the participant ID in room's privileged set
    if (isHostByKey && (role === 'host' || role === 'moderator' || currentRoom.permissions?.roles?.[role]?.some((c: string) => c.startsWith('moderation:') || c.startsWith('session:')))) {
      const currentPrivileged = currentRoom.permissions?.privilegedParticipantIds || [];
      const pidToRecord = input.participantId || uuidv4();
      if (!currentPrivileged.includes(pidToRecord)) {
        currentRoom = await this.updateRoomPermissions(currentRoom.id, {
          privilegedParticipantIds: [...currentPrivileged, pidToRecord]
        });
      }
    }

    // Authoritative Identity Determination:
    // If an untrusted caller (without valid hostKey) attempts to claim:
    // 1) room.hostId
    // 2) Any ID previously issued as privileged (host, moderator, custom privileged role)
    // 3) Any active participant's ID
    // 4) Any ID configured with custom participantOverrides
    // REASSIGN to a random uuidv4 to strictly prevent host/moderator impersonation and identity hijacking!
    let participantId = input.participantId || uuidv4();
    if (!isHostByKey) {
      const activeParticipants = await this.db.listParticipants(currentRoom.id);
      const isPrivilegedActive = activeParticipants.some(p => p.id === participantId && (p.role === 'host' || p.role === 'moderator'));
      const isRecordedPrivileged = Boolean(currentRoom.permissions?.privilegedParticipantIds?.includes(participantId));
      const hasOverride = Boolean(currentRoom.permissions?.participantOverrides?.[participantId]);

      if (participantId === currentRoom.hostId || isPrivilegedActive || isRecordedPrivileged || hasOverride) {
        participantId = uuidv4();
      }
    }

    // Compute authoritatively resolved effective permissions for this participant taking room features into account
    const effectiveSet = resolveEffectivePermissions(role, participantId, currentRoom.permissions, currentRoom.features);
    const permissions = Array.from(effectiveSet);

    const participant: Participant = {
      id: participantId,
      name: input.name,
      email: input.email,
      avatarUrl: input.avatarUrl,
      role,
      joinedAt: Date.now(),
      isAudioMuted: true,
      isVideoMuted: true,
      isScreenSharing: false,
      isHandRaised: false,
      permissions,
      metadata: input.metadata
    };

    // Sign the Nexus signaling token
    const payload: AuthTokenPayload = {
      sub: participant.id,
      name: participant.name,
      email: participant.email,
      roomId: room.id,
      roomSlug: room.slug,
      role: participant.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 3600, // 24 hours
      metadata: participant.metadata
    };

    const token = jwt.sign(payload, this.config.jwtSecret);

    // Generate Media token
    const media = await this.mediaProvider.generateSessionToken(room, participant);

    return {
      token,
      participant,
      room,
      media
    };
  }

  verifyJoinToken(token: string): AuthTokenPayload {
    return jwt.verify(token, this.config.jwtSecret) as AuthTokenPayload;
  }
}
