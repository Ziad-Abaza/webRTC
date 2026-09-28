import { v4 as uuidv4 } from 'uuid';
import {
  IDatabaseAdapter,
  BreakoutRoom
} from '@webrtc/core';

export class BreakoutService {
  constructor(private db: IDatabaseAdapter) {}

  async createBreakoutRoom(parentRoomId: string, name: string, durationMinutes?: number): Promise<BreakoutRoom> {
    const breakout: BreakoutRoom = {
      id: uuidv4(),
      parentRoomId,
      name,
      participantIds: [],
      createdAt: Date.now(),
      durationMinutes,
      isActive: true
    };

    return this.db.createBreakoutRoom(breakout);
  }

  async listBreakoutRooms(parentRoomId: string): Promise<BreakoutRoom[]> {
    return this.db.listBreakoutRooms(parentRoomId);
  }

  async assignParticipant(breakoutId: string, participantId: string): Promise<BreakoutRoom> {
    const breakout = await this.db.getBreakoutRoom(breakoutId);
    if (!breakout) throw new Error(`Breakout room ${breakoutId} not found`);

    if (!breakout.participantIds.includes(participantId)) {
      breakout.participantIds.push(participantId);
      await this.db.updateBreakoutRoom(breakoutId, {
        participantIds: breakout.participantIds
      });
    }

    return breakout;
  }

  async closeBreakoutRoom(breakoutId: string): Promise<boolean> {
    const breakout = await this.db.getBreakoutRoom(breakoutId);
    if (!breakout) return false;
    await this.db.updateBreakoutRoom(breakoutId, { isActive: false });
    return true;
  }
}
