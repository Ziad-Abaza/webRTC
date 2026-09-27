import {
  IDatabaseAdapter,
  Room,
  Participant,
  ChatMessage,
  Recording,
  BreakoutRoom,
  LiveBroadcastConfig
} from '@nexusrtc/core';

export class MemoryDatabaseAdapter implements IDatabaseAdapter {
  private rooms = new Map<string, Room>();
  private participants = new Map<string, Map<string, Participant>>(); // roomId -> (participantId -> Participant)
  private chatMessages = new Map<string, ChatMessage[]>(); // roomId -> ChatMessage[]
  private recordings = new Map<string, Recording>();
  private breakoutRooms = new Map<string, BreakoutRoom>();
  private broadcastConfigs = new Map<string, LiveBroadcastConfig>();

  async init(): Promise<void> {}
  async close(): Promise<void> {
    this.rooms.clear();
    this.participants.clear();
    this.chatMessages.clear();
    this.recordings.clear();
    this.breakoutRooms.clear();
    this.broadcastConfigs.clear();
  }

  // Room operations
  async createRoom(room: Room): Promise<Room> {
    this.rooms.set(room.id, { ...room });
    if (!this.participants.has(room.id)) {
      this.participants.set(room.id, new Map());
    }
    if (!this.chatMessages.has(room.id)) {
      this.chatMessages.set(room.id, []);
    }
    return { ...room };
  }

  async getRoomById(id: string): Promise<Room | null> {
    const room = this.rooms.get(id);
    return room ? { ...room } : null;
  }

  async getRoomBySlug(slug: string): Promise<Room | null> {
    for (const room of this.rooms.values()) {
      if (room.slug === slug) {
        return { ...room };
      }
    }
    return null;
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
    const room = this.rooms.get(id);
    if (!room) throw new Error(`Room with ID ${id} not found`);
    const updated = { ...room, ...updates, updatedAt: Date.now() };
    this.rooms.set(id, updated);
    return { ...updated };
  }

  async deleteRoom(id: string): Promise<boolean> {
    this.participants.delete(id);
    this.chatMessages.delete(id);
    return this.rooms.delete(id);
  }

  async listRooms(filter?: { status?: string; limit?: number; offset?: number }): Promise<Room[]> {
    let list = Array.from(this.rooms.values());
    if (filter?.status) {
      list = list.filter((r) => r.status === filter.status);
    }
    if (filter?.offset) {
      list = list.slice(filter.offset);
    }
    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }
    return list.map((r) => ({ ...r }));
  }

  // Participant operations
  async addParticipant(roomId: string, participant: Participant): Promise<Participant> {
    let roomMap = this.participants.get(roomId);
    if (!roomMap) {
      roomMap = new Map();
      this.participants.set(roomId, roomMap);
    }
    roomMap.set(participant.id, { ...participant });
    return { ...participant };
  }

  async getParticipant(roomId: string, participantId: string): Promise<Participant | null> {
    const roomMap = this.participants.get(roomId);
    if (!roomMap) return null;
    const participant = roomMap.get(participantId);
    return participant ? { ...participant } : null;
  }

  async listParticipants(roomId: string): Promise<Participant[]> {
    const roomMap = this.participants.get(roomId);
    if (!roomMap) return [];
    return Array.from(roomMap.values()).map((p) => ({ ...p }));
  }

  async updateParticipant(roomId: string, participantId: string, updates: Partial<Participant>): Promise<Participant> {
    const roomMap = this.participants.get(roomId);
    if (!roomMap) throw new Error(`Room ${roomId} not found`);
    const participant = roomMap.get(participantId);
    if (!participant) throw new Error(`Participant ${participantId} not found in room ${roomId}`);
    const updated = { ...participant, ...updates };
    roomMap.set(participantId, updated);
    return { ...updated };
  }

  async removeParticipant(roomId: string, participantId: string): Promise<boolean> {
    const roomMap = this.participants.get(roomId);
    if (!roomMap) return false;
    return roomMap.delete(participantId);
  }

  // Chat operations
  async saveChatMessage(message: ChatMessage): Promise<ChatMessage> {
    let list = this.chatMessages.get(message.roomId);
    if (!list) {
      list = [];
      this.chatMessages.set(message.roomId, list);
    }
    list.push({ ...message });
    return { ...message };
  }

  async getChatHistory(roomId: string, options?: { limit?: number; before?: number }): Promise<ChatMessage[]> {
    let list = this.chatMessages.get(roomId) || [];
    if (options?.before) {
      list = list.filter((m) => m.timestamp < options.before!);
    }
    if (options?.limit && list.length > options.limit) {
      list = list.slice(list.length - options.limit);
    }
    return list.map((m) => ({ ...m }));
  }

  // Recording operations
  async saveRecording(recording: Recording): Promise<Recording> {
    this.recordings.set(recording.id, { ...recording });
    return { ...recording };
  }

  async getRecording(id: string): Promise<Recording | null> {
    const rec = this.recordings.get(id);
    return rec ? { ...rec } : null;
  }

  async listRecordings(roomId?: string): Promise<Recording[]> {
    let list = Array.from(this.recordings.values());
    if (roomId) {
      list = list.filter((r) => r.roomId === roomId);
    }
    return list.map((r) => ({ ...r }));
  }

  async updateRecording(id: string, updates: Partial<Recording>): Promise<Recording> {
    const rec = this.recordings.get(id);
    if (!rec) throw new Error(`Recording ${id} not found`);
    const updated = { ...rec, ...updates };
    this.recordings.set(id, updated);
    return { ...updated };
  }

  // Breakout Rooms operations
  async createBreakoutRoom(breakout: BreakoutRoom): Promise<BreakoutRoom> {
    this.breakoutRooms.set(breakout.id, { ...breakout });
    return { ...breakout };
  }

  async getBreakoutRoom(id: string): Promise<BreakoutRoom | null> {
    const b = this.breakoutRooms.get(id);
    return b ? { ...b } : null;
  }

  async listBreakoutRooms(parentRoomId: string): Promise<BreakoutRoom[]> {
    return Array.from(this.breakoutRooms.values())
      .filter((b) => b.parentRoomId === parentRoomId)
      .map((b) => ({ ...b }));
  }

  async updateBreakoutRoom(id: string, updates: Partial<BreakoutRoom>): Promise<BreakoutRoom> {
    const b = this.breakoutRooms.get(id);
    if (!b) throw new Error(`Breakout room ${id} not found`);
    const updated = { ...b, ...updates };
    this.breakoutRooms.set(id, updated);
    return { ...updated };
  }

  async deleteBreakoutRoom(id: string): Promise<boolean> {
    return this.breakoutRooms.delete(id);
  }

  // Broadcast operations
  async saveBroadcastConfig(config: LiveBroadcastConfig): Promise<LiveBroadcastConfig> {
    this.broadcastConfigs.set(config.roomId, { ...config });
    return { ...config };
  }

  async getBroadcastConfig(roomId: string): Promise<LiveBroadcastConfig | null> {
    const b = this.broadcastConfigs.get(roomId);
    return b ? { ...b } : null;
  }
}
