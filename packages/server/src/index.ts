import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { loadConfig } from './config/index.js';
import { MemoryDatabaseAdapter } from './db/MemoryDatabaseAdapter.js';
import { SqliteDatabaseAdapter } from './db/SqliteDatabaseAdapter.js';
import { LocalStorageProvider } from './storage/LocalStorageProvider.js';
import { JitsiMediaProvider } from './media/JitsiMediaProvider.js';
import { RoomService } from './services/RoomService.js';
import { RecordingService } from './services/RecordingService.js';
import { BreakoutService } from './services/BreakoutService.js';
import { BroadcastService } from './services/BroadcastService.js';
import { WebSocketSignalingServer } from './ws/WebSocketSignalingServer.js';
import { createApiRouter } from './routes/api.js';
import { IDatabaseAdapter } from '@nexusrtc/core';

export function createServer(customDb?: IDatabaseAdapter) {
  const config = loadConfig();
  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json());

  // Pluggable Providers initialization
  const db: IDatabaseAdapter = customDb || (
    config.databaseAdapter === 'sqlite'
      ? new SqliteDatabaseAdapter(config.sqlitePath)
      : new MemoryDatabaseAdapter()
  );
  const storage = new LocalStorageProvider(config.storage.localDir);
  const media = new JitsiMediaProvider({
    domain: config.jitsi.domain,
    appId: config.jitsi.appId,
    appSecret: config.jitsi.appSecret
  });

  // Services
  const roomService = new RoomService(db, media, config);
  const recordingService = new RecordingService(db, media, storage);
  const breakoutService = new BreakoutService(db);
  const broadcastService = new BroadcastService(db, media);

  // REST API
  const apiRouter = createApiRouter(
    config,
    roomService,
    recordingService,
    breakoutService,
    broadcastService,
    db,
    storage
  );
  app.use('/api/v1', apiRouter);

  // WebSocket Signaling
  const wss = new WebSocketServer({ server, path: '/ws' });
  const signaling = new WebSocketSignalingServer(
    wss,
    roomService,
    db,
    recordingService,
    breakoutService,
    broadcastService
  );

  return {
    app,
    server,
    config,
    db,
    storage,
    media,
    roomService,
    recordingService,
    breakoutService,
    broadcastService,
    signaling,
    start: async () => {
      await db.init();
      return new Promise<void>((resolve) => {
        server.listen(config.port, config.host, () => {
          console.log(`[NexusRTC Server] Running at http://${config.host}:${config.port}`);
          console.log(`[NexusRTC Server] WebSocket signaling at ws://${config.host}:${config.port}/ws`);
          resolve();
        });
      });
    },
    stop: async () => {
      return new Promise<void>((resolve) => {
        server.close(async () => {
          await db.close();
          resolve();
        });
      });
    }
  };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('dist/index.js') || process.argv[1]?.endsWith('src/index.ts')) {
  const instance = createServer();
  instance.start();
}
