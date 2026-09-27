import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
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
  metadata?: Record<string, unknown>;
}

export class RoomService {
  constructor(
    private db: IDatabaseAdapter,
    private mediaProvider: IMediaProvider,
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

    const participantId = input.participantId || uuidv4();
    
    // Authoritative role derivation:
    // A participant can ONLY be granted 'host' or 'moderator' role if:
    // 1. Their participantId matches room.hostId, OR
    // 2. A valid hostKey matching room.hostKey is provided.
    // Otherwise, any requested host/moderator role is rejected or downgraded to participant.
    let role: ParticipantRole = 'participant';
    const requestedRole = input.role || (input.participantId === room.hostId ? 'host' : 'participant');

    if (requestedRole === 'host' || requestedRole === 'moderator') {
      const isHostById = Boolean(room.hostId && input.participantId && input.participantId === room.hostId);
      const isHostByKey = Boolean(room.hostKey && input.hostKey && input.hostKey === room.hostKey);

      if (isHostById || isHostByKey) {
        role = requestedRole;
      } else {
        // Demote to standard participant - untrusted callers cannot claim host/moderator role
        role = 'participant';
      }
    } else {
      role = requestedRole;
    }

    // Compute authoritatively resolved effective permissions for this participant
    const effectiveSet = resolveEffectivePermissions(role, participantId, room.permissions);
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
