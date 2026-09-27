import { Router, Request, Response } from 'express';
import { RoomService } from '../services/RoomService.js';
import { RecordingService } from '../services/RecordingService.js';
import { BreakoutService } from '../services/BreakoutService.js';
import { BroadcastService } from '../services/BroadcastService.js';
import { LocalStorageProvider } from '../storage/LocalStorageProvider.js';
import { IDatabaseAdapter } from '@nexusrtc/core';
import { apiKeyMiddleware } from '../middlewares/auth.js';
import { ServerConfig } from '../config/index.js';
import fs from 'fs';

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

  // Health check
  router.get('/health', (req: Request, res: Response) => {
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
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/rooms/:idOrSlug', async (req: Request, res: Response) => {
    try {
      const room = await roomService.getRoom(req.params.idOrSlug);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      res.json(room);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/rooms/:id', auth, async (req: Request, res: Response) => {
    try {
      const room = await roomService.closeRoom(req.params.id);
      res.json({ success: true, room });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Generate join token for a participant (Called by backend like Laravel or client with secret)
  router.post('/rooms/:idOrSlug/token', auth, async (req: Request, res: Response) => {
    try {
      const result = await roomService.generateJoinToken(req.params.idOrSlug, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Participants
  router.get('/rooms/:roomId/participants', async (req: Request, res: Response) => {
    try {
      const participants = await db.listParticipants(req.params.roomId);
      res.json(participants);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Chat History
  router.get('/rooms/:roomId/chat', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const history = await db.getChatHistory(req.params.roomId, { limit });
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Recordings
  router.get('/rooms/:roomId/recordings', auth, async (req: Request, res: Response) => {
    try {
      const recordings = await recordingService.listRecordings(req.params.roomId);
      res.json(recordings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

  // Recording static file download endpoint
  router.get('/recordings/file/:key', async (req: Request, res: Response) => {
    try {
      const key = decodeURIComponent(req.params.key);
      const filePath = storageProvider.getFilePath(key);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      res.sendFile(filePath);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Breakout Rooms
  router.get('/rooms/:roomId/breakouts', async (req: Request, res: Response) => {
    try {
      const breakouts = await breakoutService.listBreakoutRooms(req.params.roomId);
      res.json(breakouts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
