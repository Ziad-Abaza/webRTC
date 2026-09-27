import { EventEmitter } from './EventEmitter.js';
import { BreakoutRoom, NexusEvents } from '@nexusrtc/core';

export class BreakoutManager extends EventEmitter {
  private breakoutRooms: Map<string, BreakoutRoom> = new Map();
  private currentBreakoutRoomId: string | null = null;

  constructor(private sendSocketMessage: (event: NexusEvents, payload: any) => void) {
    super();
  }

  setInitialBreakouts(rooms: BreakoutRoom[]): void {
    this.breakoutRooms.clear();
    for (const r of rooms) {
      this.breakoutRooms.set(r.id, r);
    }
    this.emit('updated', this.getBreakoutRooms());
  }

  handleBreakoutCreated(breakout: BreakoutRoom): void {
    this.breakoutRooms.set(breakout.id, breakout);
    this.emit('created', breakout);
    this.emit('updated', this.getBreakoutRooms());
  }

  handleBreakoutUpdated(breakout: BreakoutRoom): void {
    this.breakoutRooms.set(breakout.id, breakout);
    this.emit('updated', this.getBreakoutRooms());
  }

  createBreakout(name: string, durationMinutes?: number): void {
    this.sendSocketMessage(NexusEvents.BREAKOUT_CREATE, { name, durationMinutes });
  }

  joinBreakout(breakoutRoomId: string): void {
    this.currentBreakoutRoomId = breakoutRoomId;
    this.sendSocketMessage(NexusEvents.BREAKOUT_JOIN, { breakoutRoomId });
    this.emit('joined', breakoutRoomId);
  }

  leaveBreakout(): void {
    this.currentBreakoutRoomId = null;
    this.sendSocketMessage(NexusEvents.BREAKOUT_LEAVE, {});
    this.emit('left');
  }

  broadcastToAll(message: string): void {
    this.sendSocketMessage(NexusEvents.BREAKOUT_BROADCAST, { message });
  }

  getBreakoutRooms(): BreakoutRoom[] {
    return Array.from(this.breakoutRooms.values());
  }

  getCurrentBreakoutRoomId(): string | null {
    return this.currentBreakoutRoomId;
  }
}
