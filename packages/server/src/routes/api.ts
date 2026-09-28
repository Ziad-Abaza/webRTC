import { Router, Request, Response } from 'express';
import { RoomService } from '../services/RoomService.js';
import { RecordingService } from '../services/RecordingService.js';
import { BreakoutService } from '../services/BreakoutService.js';
import { BroadcastService } from '../services/BroadcastService.js';
import { LocalStorageProvider } from '../storage/LocalStorageProvider.js';
import { IDatabaseAdapter, Room, RoomPermission, resolveEffectivePermissions } from '@webrtc/core';
import { apiKeyMiddleware, apiKeyOrJwtMiddleware, AuthenticatedRequest } from '../middlewares/auth.js';
import { ServerConfig } from '../config/index.js';
import fs from 'fs';

/**
 * Sanitizes room object for public or participant-facing consumption.
 * Ensures internal hostKey and password are never leaked to non-admin callers.
 */
function sanitizeRoom(room: Room): Partial<Room> {
  const { hostKey, password, ...safe } = room;
  return safe;
}

export function createApiRouter(
  config: ServerConfig,
  roomService: RoomService,
  recordingService: RecordingService,
  breakoutService: BreakoutService,
  broadcastService: BroadcastService,
  db: IDatabaseAdapter,
  storageProvider: LocalStorageProvider
): Router {
  const router = Router();
  const auth = apiKeyMiddleware(config);
  const sessionAuth = apiKeyOrJwtMiddleware(config);

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'WebRTC Engine',
      version: '1.0.0',
      timestamp: Date.now()
    });
  });

  // Room Management (Protected by API Key for server-to-server calls like Laravel)
  router.post('/rooms', auth, async (req: Request, res: Response) => {
    try {
      const room = await roomService.createRoom(req.body);
      // Return full room (including hostKey) to authorized backend creator
      res.status(201).json(room);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/rooms', auth, async (req: Request, res: Response) => {
    try {
      const rooms = await roomService.listRooms(req.query.status as string);
      res.json(rooms);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve rooms' });
    }
  });

  // Single room metadata lookup (can be queried by backend with API key or participant with valid room session)
  router.get('/rooms/:idOrSlug', async (req: Request, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.idOrSlug);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      
      // If requested by master API key, return full object including hostKey.
      // Otherwise, return sanitized room metadata without leaking host credentials.
      const authHeader = req.headers.authorization;
      const apiKey = (req.headers['x-api-key'] as string) || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
      if (apiKey === config.apiKey) {
        res.json(room);
      } else {
        res.json(sanitizeRoom(room));
      }
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/rooms/:id', auth, async (req: Request, res: Response) => {
    try {
      const room = await roomService.closeRoom(req.params.id);
      res.json({ success: true, room: sanitizeRoom(room) });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Room Granular Permissions & Policy Control
  router.get('/rooms/:idOrSlug/permissions', async (req: Request, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.idOrSlug);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      res.json(room.permissions || {});
    } catch {
      res.status(500).json({ error: 'Failed to retrieve permissions' });
    }
  });

  router.put('/rooms/:idOrSlug/permissions', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.idOrSlug);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (req.participant) {
        if (req.participant.roomId !== room.id && req.participant.roomSlug !== room.slug) {
          res.status(403).json({ error: 'Forbidden: Access to another room is prohibited' });
          return;
        }
        if (room.permissions?.bannedParticipantIds?.includes(req.participant.sub)) {
          res.status(403).json({ error: 'Forbidden: Participant has been evicted from this session' });
          return;
        }
        const effective = resolveEffectivePermissions(req.participant.role, req.participant.sub, room.permissions, room.features);
        if (!effective.has(RoomPermission.UPDATE_ROOM_PERMISSIONS)) {
          res.status(403).json({ error: 'Forbidden: Insufficient permissions to update room permissions' });
          return;
        }
        const isCallerHost = req.participant.role === 'host' || req.participant.sub === room.hostId;
        if (!isCallerHost && (req.body.roles || req.body.participantOverrides)) {
          res.status(403).json({ error: 'Forbidden: Only room host can modify role capabilities or participant overrides' });
          return;
        }
      }
      const updated = await roomService.updateRoomPermissions(room.id, req.body);
      res.json({ success: true, permissions: updated.permissions });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  function isCallerRoomHost(req: AuthenticatedRequest, room: Room, apiKey?: string): boolean {
    if (apiKey && apiKey === config.apiKey) return true;
    if (!req.participant) return false;
    if (req.participant.roomId !== room.id && req.participant.roomSlug !== room.slug) return false;
    return req.participant.role === 'host' || req.participant.sub === room.hostId;
  }

  // Generate join token for a participant
  router.post('/rooms/:idOrSlug/token', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const apiKey = (req.headers['x-api-key'] as string) || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
    const hasValidApiKey = apiKey === config.apiKey;

    if (!hasValidApiKey && !req.body?.inviteCode) {
      res.status(401).json({ error: 'Unauthorized: Master API key or invitation code required' });
      return;
    }

    try {
      const result = await roomService.generateJoinToken(req.params.idOrSlug, req.body);
      res.json({
        ...result,
        room: sanitizeRoom(result.room)
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Room Invitations (Protected: Room host or master API key)
  router.post('/rooms/:idOrSlug/invitations', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.idOrSlug);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      const authHeader = req.headers.authorization;
      const apiKey = (req.headers['x-api-key'] as string) || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
      if (!isCallerRoomHost(req, room, apiKey || undefined)) {
        res.status(403).json({ error: 'Forbidden: Only room host can create invitations' });
        return;
      }

      const invitation = await roomService.createInvitation(
        room.id,
        req.body,
        req.participant?.sub || room.hostId
      );
      res.status(201).json(invitation);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/rooms/:idOrSlug/invitations', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.idOrSlug);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      const authHeader = req.headers.authorization;
      const apiKey = (req.headers['x-api-key'] as string) || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
      if (!isCallerRoomHost(req, room, apiKey || undefined)) {
        res.status(403).json({ error: 'Forbidden: Only room host can view invitations' });
        return;
      }

      const list = await roomService.listInvitations(room.id);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve invitations' });
    }
  });

  router.post('/invitations/:codeOrId/revoke', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const invLookup = (await db.getInvitationByCode(req.params.codeOrId)) || (await db.getInvitationById(req.params.codeOrId));
      if (!invLookup) {
        res.status(404).json({ error: 'Invitation not found' });
        return;
      }
      const room = await roomService.getRoom(invLookup.roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      const authHeader = req.headers.authorization;
      const apiKey = (req.headers['x-api-key'] as string) || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
      if (!isCallerRoomHost(req, room, apiKey || undefined)) {
        res.status(403).json({ error: 'Forbidden: Only room host can revoke invitations' });
        return;
      }

      const revoked = await roomService.revokeInvitation(invLookup.id);
      res.json({ success: true, invitation: revoked });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Public Invitation Lookup (Validates invitation code and provides sanitized preview)
  router.get('/invitations/:code', async (req: Request, res: Response) => {
    try {
      const result = await roomService.getInvitation(req.params.code);
      if (!result) {
        res.status(404).json({ error: 'Invitation not found or invalid' });
        return;
      }
      const { invitation, room } = result;
      const isExpired = Boolean(
        invitation.status === 'expired' || 
        (invitation.expiresAt && Date.now() > invitation.expiresAt)
      );
      const isLimitReached = Boolean(invitation.maxUses && invitation.usesCount >= invitation.maxUses);
      const isRevoked = invitation.status === 'revoked';
      const isRoomActive = room.status === 'active';

      res.json({
        code: invitation.code,
        roomId: invitation.roomId,
        roomSlug: invitation.roomSlug,
        roomTitle: room.title,
        role: invitation.role,
        maxUses: invitation.maxUses,
        usesCount: invitation.usesCount,
        expiresAt: invitation.expiresAt,
        status: isRevoked ? 'revoked' : (isExpired || isLimitReached ? 'expired' : invitation.status),
        isValid: !isRevoked && !isExpired && !isLimitReached && isRoomActive
      });
    } catch {
      res.status(500).json({ error: 'Internal server error inspecting invitation' });
    }
  });

  // Participants in a room (Protected: requires master API key or active session token for this room)
  router.get('/rooms/:roomId/participants', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate tenant/room boundary if accessed via participant token
      if (req.participant && req.participant.roomId !== req.params.roomId) {
        res.status(403).json({ error: 'Forbidden: Access to another room is prohibited' });
        return;
      }
      const participants = await db.listParticipants(req.params.roomId);
      res.json(participants);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve participants' });
    }
  });

  // Chat History (Protected: requires master API key or active session token for this room)
  router.get('/rooms/:roomId/chat', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.participant && req.participant.roomId !== req.params.roomId) {
        res.status(403).json({ error: 'Forbidden: Access to another room chat is prohibited' });
        return;
      }
      const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 50;
      const history = await db.getChatHistory(req.params.roomId, { limit });
      res.json(history);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve chat history' });
    }
  });

  // Recordings
  router.get('/rooms/:roomId/recordings', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.participant && req.participant.roomId !== req.params.roomId) {
        res.status(403).json({ error: 'Forbidden: Access to another room recordings is prohibited' });
        return;
      }
      if (req.participant) {
        const room = await roomService.getRoom(req.params.roomId);
        const effective = resolveEffectivePermissions(req.participant.role, req.participant.sub, room?.permissions, room?.features);
        if (!effective.has(RoomPermission.START_RECORDING) && !effective.has(RoomPermission.STOP_RECORDING) && req.participant.role !== 'host') {
          res.status(403).json({ error: 'Forbidden: Insufficient permissions to view room recordings' });
          return;
        }
      }
      const recordings = await recordingService.listRecordings(req.params.roomId);
      res.json(recordings);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve recordings' });
    }
  });

  router.post('/rooms/:roomId/recordings/start', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (req.participant) {
        if (req.participant.roomId !== room.id && req.participant.roomSlug !== room.slug) {
          res.status(403).json({ error: 'Forbidden: Access to another room is prohibited' });
          return;
        }
        const effective = resolveEffectivePermissions(req.participant.role, req.participant.sub, room.permissions, room.features);
        if (!effective.has(RoomPermission.START_RECORDING)) {
          res.status(403).json({ error: 'Forbidden: Insufficient permissions to start recording' });
          return;
        }
      }
      const recording = await recordingService.startRecording(room.id);
      res.status(201).json(recording);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/recordings/:recordingId/stop', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.participant) {
        const callerRoom = await roomService.getRoom(req.participant.roomId);
        const effective = resolveEffectivePermissions(req.participant.role, req.participant.sub, callerRoom?.permissions, callerRoom?.features);
        if (!effective.has(RoomPermission.STOP_RECORDING)) {
          res.status(403).json({ error: 'Forbidden: Insufficient permissions to stop recording' });
          return;
        }
      }
      const recording = await db.getRecording(req.params.recordingId);
      if (!recording) {
        res.status(404).json({ error: 'Recording not found' });
        return;
      }
      if (req.participant && req.participant.roomId !== recording.roomId) {
        res.status(403).json({ error: 'Forbidden: Access to another room recording is prohibited' });
        return;
      }
      const result = await recordingService.stopRecording(req.params.recordingId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Recording file download endpoint (Protected: master API key or valid session token)
  router.get('/recordings/file/*', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rawKey = req.params[0] || (req.query.key as string) || '';
      const key = decodeURIComponent(rawKey);
      
      // Prevent path traversal
      let filePath: string;
      try {
        filePath = storageProvider.getFilePath(key);
      } catch (pathErr: any) {
        res.status(400).json({ error: 'Invalid file key or path traversal detected' });
        return;
      }

      // If accessed via participant session token, enforce tenant & recording access boundary
      if (req.participant) {
        const recordings = await recordingService.listRecordings(req.participant.roomId);
        const ownsFile = recordings.some(r => r.storageKey === key || (r.fileUrl && r.fileUrl.includes(key)));
        if (!ownsFile) {
          res.status(403).json({ error: 'Forbidden: Access to recording from another room is prohibited' });
          return;
        }
      }

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Recording file not found' });
        return;
      }

      res.sendFile(filePath);
    } catch {
      res.status(500).json({ error: 'Internal server error reading recording file' });
    }
  });

  // Breakout Rooms
  router.get('/rooms/:roomId/breakouts', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.participant && req.participant.roomId !== req.params.roomId) {
        res.status(403).json({ error: 'Forbidden: Access to another room breakouts is prohibited' });
        return;
      }
      const breakouts = await breakoutService.listBreakoutRooms(req.params.roomId);
      res.json(breakouts);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve breakout rooms' });
    }
  });

  router.post('/rooms/:roomId/breakouts', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (req.participant) {
        if (req.participant.roomId !== room.id && req.participant.roomSlug !== room.slug) {
          res.status(403).json({ error: 'Forbidden: Access to another room is prohibited' });
          return;
        }
        const effective = resolveEffectivePermissions(req.participant.role, req.participant.sub, room.permissions, room.features);
        if (!effective.has(RoomPermission.CREATE_BREAKOUT)) {
          res.status(403).json({ error: 'Forbidden: Insufficient permissions to create breakout rooms' });
          return;
        }
      }
      const { name, durationMinutes } = req.body;
      const breakout = await breakoutService.createBreakoutRoom(room.id, name, durationMinutes);
      res.status(201).json(breakout);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Live Broadcast
  router.post('/rooms/:roomId/broadcast/start', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (req.participant) {
        if (req.participant.roomId !== room.id && req.participant.roomSlug !== room.slug) {
          res.status(403).json({ error: 'Forbidden: Access to another room is prohibited' });
          return;
        }
        const effective = resolveEffectivePermissions(req.participant.role, req.participant.sub, room.permissions, room.features);
        if (!effective.has(RoomPermission.START_BROADCAST)) {
          res.status(403).json({ error: 'Forbidden: Insufficient permissions to start live broadcast' });
          return;
        }
      }
      const { streamUrl, streamKey } = req.body;
      const b = await broadcastService.startBroadcast(room.id, streamUrl, streamKey);
      res.json(b);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/broadcast/stop', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (req.participant) {
        if (req.participant.roomId !== room.id && req.participant.roomSlug !== room.slug) {
          res.status(403).json({ error: 'Forbidden: Access to another room is prohibited' });
          return;
        }
        const effective = resolveEffectivePermissions(req.participant.role, req.participant.sub, room.permissions, room.features);
        if (!effective.has(RoomPermission.STOP_BROADCAST)) {
          res.status(403).json({ error: 'Forbidden: Insufficient permissions to stop live broadcast' });
          return;
        }
      }
      const b = await broadcastService.stopBroadcast(room.id);
      res.json(b);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
