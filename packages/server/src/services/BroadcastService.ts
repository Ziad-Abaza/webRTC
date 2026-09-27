import { v4 as uuidv4 } from 'uuid';
import {
  IDatabaseAdapter,
  IMediaProvider,
  LiveBroadcastConfig
} from '@nexusrtc/core';

export class BroadcastService {
  constructor(
    private db: IDatabaseAdapter,
    private mediaProvider: IMediaProvider
  ) {}

  async startBroadcast(roomId: string, streamUrl: string, streamKey: string): Promise<LiveBroadcastConfig> {
    const existing = await this.db.getBroadcastConfig(roomId);
    if (existing && existing.status === 'live') {
      return existing;
    }

    const { broadcastId } = await this.mediaProvider.startBroadcast(roomId, streamUrl, streamKey);

    const config: LiveBroadcastConfig = {
      id: broadcastId,
      roomId,
      streamUrl,
      streamKey,
      status: 'live',
      startedAt: Date.now()
    };

    return this.db.saveBroadcastConfig(config);
  }

  async stopBroadcast(roomId: string): Promise<LiveBroadcastConfig> {
    const config = await this.db.getBroadcastConfig(roomId);
    if (!config) throw new Error(`No broadcast found for room ${roomId}`);

    await this.mediaProvider.stopBroadcast(roomId, config.id);

    config.status = 'stopped';
    config.stoppedAt = Date.now();
    return this.db.saveBroadcastConfig(config);
  }

  async getBroadcast(roomId: string): Promise<LiveBroadcastConfig | null> {
    return this.db.getBroadcastConfig(roomId);
  }
}
