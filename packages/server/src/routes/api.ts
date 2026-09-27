import { Router, Request, Response } from 'express';
import { RoomService } from '../services/RoomService.js';
import { RecordingService } from '../services/RecordingService.js';
import { BreakoutService } from '../services/BreakoutService.js';
import { BroadcastService } from '../services/BroadcastService.js';
import { LocalStorageProvider } from '../storage/LocalStorageProvider.js';
import { IDatabaseAdapter, Room } from '@nexusrtc/core';
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
      service: 'NexusRTC Engine',
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

  router.put('/rooms/:idOrSlug/permissions', auth, async (req: Request, res: Response) => {
    try {
      const room = await roomService.updateRoomPermissions(req.params.idOrSlug, req.body);
      res.json({ success: true, permissions: room.permissions });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Generate join token for a participant
  router.post('/rooms/:idOrSlug/token', auth, async (req: Request, res: Response) => {
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
      const recordings = await recordingService.listRecordings(req.params.roomId);
      res.json(recordings);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve recordings' });
    }
  });

  router.post('/rooms/:roomId/recordings/start', auth, async (req: Request, res: Response) => {
    try {
      const recording = await recordingService.startRecording(req.params.roomId);
      res.status(201).json(recording);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/recordings/:recordingId/stop', auth, async (req: Request, res: Response) => {
    try {
      const recording = await recordingService.stopRecording(req.params.recordingId);
      res.json(recording);
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

  router.post('/rooms/:roomId/breakouts', auth, async (req: Request, res: Response) => {
    try {
      const { name, durationMinutes } = req.body;
      const breakout = await breakoutService.createBreakoutRoom(req.params.roomId, name, durationMinutes);
      res.status(201).json(breakout);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Live Broadcast
  router.post('/rooms/:roomId/broadcast/start', auth, async (req: Request, res: Response) => {
    try {
      const { streamUrl, streamKey } = req.body;
      const b = await broadcastService.startBroadcast(req.params.roomId, streamUrl, streamKey);
      res.json(b);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/broadcast/stop', auth, async (req: Request, res: Response) => {
    try {
      const b = await broadcastService.stopBroadcast(req.params.roomId);
      res.json(b);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
