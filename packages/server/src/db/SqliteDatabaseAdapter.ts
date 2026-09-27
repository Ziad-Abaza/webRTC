import Database from 'better-sqlite3';
import {
  IDatabaseAdapter,
  Room,
  Participant,
  ChatMessage,
  Recording,
  BreakoutRoom,
  LiveBroadcastConfig
} from '@nexusrtc/core';
import path from 'path';
import fs from 'fs';

export class SqliteDatabaseAdapter implements IDatabaseAdapter {
  private db!: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = './storage/nexusrtc.sqlite') {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(path.resolve(this.dbPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        password TEXT,
        hostId TEXT NOT NULL,
        features TEXT NOT NULL,
        mediaProvider TEXT NOT NULL,
        mediaConfig TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        closedAt INTEGER,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS participants (
        id TEXT NOT NULL,
        roomId TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        avatarUrl TEXT,
        role TEXT NOT NULL,
        joinedAt INTEGER NOT NULL,
        isAudioMuted INTEGER NOT NULL,
        isVideoMuted INTEGER NOT NULL,
        isScreenSharing INTEGER NOT NULL,
        isHandRaised INTEGER NOT NULL,
        handRaisedAt INTEGER,
        currentBreakoutRoomId TEXT,
        metadata TEXT,
        PRIMARY KEY (id, roomId),
        FOREIGN KEY (roomId) REFERENCES rooms (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        senderName TEXT NOT NULL,
        senderRole TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        isPrivate INTEGER NOT NULL,
        recipientId TEXT,
        FOREIGN KEY (roomId) REFERENCES rooms (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        status TEXT NOT NULL,
        startedAt INTEGER NOT NULL,
        stoppedAt INTEGER,
        durationSeconds INTEGER,
        fileSizeBytes INTEGER,
        fileUrl TEXT,
        storageKey TEXT,
        downloadUrl TEXT,
        metadata TEXT,
        error TEXT,
        FOREIGN KEY (roomId) REFERENCES rooms (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS breakout_rooms (
        id TEXT PRIMARY KEY,
        parentRoomId TEXT NOT NULL,
        name TEXT NOT NULL,
        participantIds TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        durationMinutes INTEGER,
        isActive INTEGER NOT NULL,
        FOREIGN KEY (parentRoomId) REFERENCES rooms (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS broadcast_configs (
        roomId TEXT PRIMARY KEY,
        id TEXT NOT NULL,
        streamUrl TEXT NOT NULL,
        streamKey TEXT NOT NULL,
        status TEXT NOT NULL,
        viewerUrl TEXT,
        startedAt INTEGER,
        stoppedAt INTEGER,
        error TEXT,
        FOREIGN KEY (roomId) REFERENCES rooms (id) ON DELETE CASCADE
      );
    `);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }

  // Room operations
  async createRoom(room: Room): Promise<Room> {
    const stmt = this.db.prepare(`
      INSERT INTO rooms (
        id, slug, title, description, status, password, hostId,
        features, mediaProvider, mediaConfig, createdAt, updatedAt, closedAt, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      room.id,
      room.slug,
      room.title,
      room.description || null,
      room.status,
      room.password || null,
      room.hostId,
      JSON.stringify(room.features),
      room.mediaProvider,
      JSON.stringify(room.mediaConfig),
      room.createdAt,
      room.updatedAt,
      room.closedAt || null,
      room.metadata ? JSON.stringify(room.metadata) : null
    );

    return { ...room };
  }

  async getRoomById(id: string): Promise<Room | null> {
    const row: any = this.db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    return row ? this.mapRoomRow(row) : null;
  }

  async getRoomBySlug(slug: string): Promise<Room | null> {
    const row: any = this.db.prepare('SELECT * FROM rooms WHERE slug = ?').get(slug);
    return row ? this.mapRoomRow(row) : null;
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
    const current = await this.getRoomById(id);
    if (!current) throw new Error(`Room with ID ${id} not found`);

    const updated: Room = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };

    const stmt = this.db.prepare(`
      UPDATE rooms SET
        title = ?, description = ?, status = ?, password = ?, hostId = ?,
        features = ?, mediaProvider = ?, mediaConfig = ?, updatedAt = ?, closedAt = ?, metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.title,
      updated.description || null,
      updated.status,
      updated.password || null,
      updated.hostId,
      JSON.stringify(updated.features),
      updated.mediaProvider,
      JSON.stringify(updated.mediaConfig),
      updated.updatedAt,
      updated.closedAt || null,
      updated.metadata ? JSON.stringify(updated.metadata) : null,
      id
    );

    return updated;
  }

  async deleteRoom(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async listRooms(filter?: { status?: string; limit?: number; offset?: number }): Promise<Room[]> {
    let query = 'SELECT * FROM rooms';
    const params: any[] = [];

    if (filter?.status) {
      query += ' WHERE status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY createdAt DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
      if (filter?.offset) {
        query += ' OFFSET ?';
        params.push(filter.offset);
      }
    }

    const rows: any[] = this.db.prepare(query).all(...params);
    return rows.map((r) => this.mapRoomRow(r));
  }

  // Participant operations
  async addParticipant(roomId: string, participant: Participant): Promise<Participant> {
    const stmt = this.db.prepare(`
      INSERT INTO participants (
        id, roomId, name, email, avatarUrl, role, joinedAt,
        isAudioMuted, isVideoMuted, isScreenSharing, isHandRaised,
        handRaisedAt, currentBreakoutRoomId, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, roomId) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        isAudioMuted = excluded.isAudioMuted,
        isVideoMuted = excluded.isVideoMuted,
        isScreenSharing = excluded.isScreenSharing,
        isHandRaised = excluded.isHandRaised,
        handRaisedAt = excluded.handRaisedAt,
        currentBreakoutRoomId = excluded.currentBreakoutRoomId,
        metadata = excluded.metadata
    `);

    stmt.run(
      participant.id,
      roomId,
      participant.name,
      participant.email || null,
      participant.avatarUrl || null,
      participant.role,
      participant.joinedAt,
      participant.isAudioMuted ? 1 : 0,
      participant.isVideoMuted ? 1 : 0,
      participant.isScreenSharing ? 1 : 0,
      participant.isHandRaised ? 1 : 0,
      participant.handRaisedAt || null,
      participant.currentBreakoutRoomId || null,
      participant.metadata ? JSON.stringify(participant.metadata) : null
    );

    return { ...participant };
  }

  async getParticipant(roomId: string, participantId: string): Promise<Participant | null> {
    const row: any = this.db.prepare('SELECT * FROM participants WHERE roomId = ? AND id = ?').get(roomId, participantId);
    return row ? this.mapParticipantRow(row) : null;
  }

  async listParticipants(roomId: string): Promise<Participant[]> {
    const rows: any[] = this.db.prepare('SELECT * FROM participants WHERE roomId = ? ORDER BY joinedAt ASC').all(roomId);
    return rows.map((r) => this.mapParticipantRow(r));
  }

  async updateParticipant(roomId: string, participantId: string, updates: Partial<Participant>): Promise<Participant> {
    const current = await this.getParticipant(roomId, participantId);
    if (!current) throw new Error(`Participant ${participantId} not found in room ${roomId}`);

    const updated: Participant = { ...current, ...updates };

    const stmt = this.db.prepare(`
      UPDATE participants SET
        name = ?, role = ?, isAudioMuted = ?, isVideoMuted = ?,
        isScreenSharing = ?, isHandRaised = ?, handRaisedAt = ?,
        currentBreakoutRoomId = ?, metadata = ?
      WHERE roomId = ? AND id = ?
    `);

    stmt.run(
      updated.name,
      updated.role,
      updated.isAudioMuted ? 1 : 0,
      updated.isVideoMuted ? 1 : 0,
      updated.isScreenSharing ? 1 : 0,
      updated.isHandRaised ? 1 : 0,
      updated.handRaisedAt || null,
      updated.currentBreakoutRoomId || null,
      updated.metadata ? JSON.stringify(updated.metadata) : null,
      roomId,
      participantId
    );

    return updated;
  }

  async removeParticipant(roomId: string, participantId: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM participants WHERE roomId = ? AND id = ?').run(roomId, participantId);
    return result.changes > 0;
  }

  // Chat operations
  async saveChatMessage(message: ChatMessage): Promise<ChatMessage> {
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, roomId, senderId, senderName, senderRole, content, timestamp, isPrivate, recipientId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.roomId,
      message.senderId,
      message.senderName,
      message.senderRole,
      message.content,
      message.timestamp,
      message.isPrivate ? 1 : 0,
      message.recipientId || null
    );

    return { ...message };
  }

  async getChatHistory(roomId: string, options?: { limit?: number; before?: number }): Promise<ChatMessage[]> {
    let query = 'SELECT * FROM chat_messages WHERE roomId = ?';
    const params: any[] = [roomId];

    if (options?.before) {
      query += ' AND timestamp < ?';
      params.push(options.before);
    }

    query += ' ORDER BY timestamp ASC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows: any[] = this.db.prepare(query).all(...params);
    return rows.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      senderId: r.senderId,
      senderName: r.senderName,
      senderRole: r.senderRole,
      content: r.content,
      timestamp: r.timestamp,
      isPrivate: r.isPrivate === 1,
      recipientId: r.recipientId || undefined
    }));
  }

  // Recording operations
  async saveRecording(recording: Recording): Promise<Recording> {
    const stmt = this.db.prepare(`
      INSERT INTO recordings (
        id, roomId, status, startedAt, stoppedAt, durationSeconds,
        fileSizeBytes, fileUrl, storageKey, downloadUrl, metadata, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        stoppedAt = excluded.stoppedAt,
        durationSeconds = excluded.durationSeconds,
        fileSizeBytes = excluded.fileSizeBytes,
        fileUrl = excluded.fileUrl,
        storageKey = excluded.storageKey,
        downloadUrl = excluded.downloadUrl,
        metadata = excluded.metadata,
        error = excluded.error
    `);

    stmt.run(
      recording.id,
      recording.roomId,
      recording.status,
      recording.startedAt,
      recording.stoppedAt || null,
      recording.durationSeconds || null,
      recording.fileSizeBytes || null,
      recording.fileUrl || null,
      recording.storageKey || null,
      recording.downloadUrl || null,
      recording.metadata ? JSON.stringify(recording.metadata) : null,
      recording.error || null
    );

    return { ...recording };
  }

  async getRecording(id: string): Promise<Recording | null> {
    const row: any = this.db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
    return row ? this.mapRecordingRow(row) : null;
  }

  async listRecordings(roomId?: string): Promise<Recording[]> {
    let query = 'SELECT * FROM recordings';
    const params: any[] = [];
    if (roomId) {
      query += ' WHERE roomId = ?';
      params.push(roomId);
    }
    query += ' ORDER BY startedAt DESC';
    const rows: any[] = this.db.prepare(query).all(...params);
    return rows.map((r) => this.mapRecordingRow(r));
  }

  async updateRecording(id: string, updates: Partial<Recording>): Promise<Recording> {
    const current = await this.getRecording(id);
    if (!current) throw new Error(`Recording ${id} not found`);

    const updated: Recording = { ...current, ...updates };
    return this.saveRecording(updated);
  }

  // Breakout Rooms operations
  async createBreakoutRoom(breakout: BreakoutRoom): Promise<BreakoutRoom> {
    const stmt = this.db.prepare(`
      INSERT INTO breakout_rooms (id, parentRoomId, name, participantIds, createdAt, durationMinutes, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        participantIds = excluded.participantIds,
        isActive = excluded.isActive
    `);

    stmt.run(
      breakout.id,
      breakout.parentRoomId,
      breakout.name,
      JSON.stringify(breakout.participantIds),
      breakout.createdAt,
      breakout.durationMinutes || null,
      breakout.isActive ? 1 : 0
    );

    return { ...breakout };
  }

  async getBreakoutRoom(id: string): Promise<BreakoutRoom | null> {
    const row: any = this.db.prepare('SELECT * FROM breakout_rooms WHERE id = ?').get(id);
    return row ? this.mapBreakoutRow(row) : null;
  }

  async listBreakoutRooms(parentRoomId: string): Promise<BreakoutRoom[]> {
    const rows: any[] = this.db.prepare('SELECT * FROM breakout_rooms WHERE parentRoomId = ?').all(parentRoomId);
    return rows.map((r) => this.mapBreakoutRow(r));
  }

  async updateBreakoutRoom(id: string, updates: Partial<BreakoutRoom>): Promise<BreakoutRoom> {
    const current = await this.getBreakoutRoom(id);
    if (!current) throw new Error(`Breakout room ${id} not found`);

    const updated: BreakoutRoom = { ...current, ...updates };
    return this.createBreakoutRoom(updated);
  }

  async deleteBreakoutRoom(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM breakout_rooms WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Broadcast operations
  async saveBroadcastConfig(config: LiveBroadcastConfig): Promise<LiveBroadcastConfig> {
    const stmt = this.db.prepare(`
      INSERT INTO broadcast_configs (roomId, id, streamUrl, streamKey, status, viewerUrl, startedAt, stoppedAt, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(roomId) DO UPDATE SET
        id = excluded.id,
        streamUrl = excluded.streamUrl,
        streamKey = excluded.streamKey,
        status = excluded.status,
        viewerUrl = excluded.viewerUrl,
        startedAt = excluded.startedAt,
        stoppedAt = excluded.stoppedAt,
        error = excluded.error
    `);

    stmt.run(
      config.roomId,
      config.id,
      config.streamUrl,
      config.streamKey,
      config.status,
      config.viewerUrl || null,
      config.startedAt || null,
      config.stoppedAt || null,
      config.error || null
    );

    return { ...config };
  }

  async getBroadcastConfig(roomId: string): Promise<LiveBroadcastConfig | null> {
    const row: any = this.db.prepare('SELECT * FROM broadcast_configs WHERE roomId = ?').get(roomId);
    if (!row) return null;
    return {
      id: row.id,
      roomId: row.roomId,
      streamUrl: row.streamUrl,
      streamKey: row.streamKey,
      status: row.status,
      viewerUrl: row.viewerUrl || undefined,
      startedAt: row.startedAt || undefined,
      stoppedAt: row.stoppedAt || undefined,
      error: row.error || undefined
    };
  }

  // Mappers
  private mapRoomRow(row: any): Room {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description || undefined,
      status: row.status,
      password: row.password || undefined,
      hostId: row.hostId,
      features: JSON.parse(row.features),
      mediaProvider: row.mediaProvider,
      mediaConfig: JSON.parse(row.mediaConfig),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      closedAt: row.closedAt || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  private mapParticipantRow(row: any): Participant {
    return {
      id: row.id,
      name: row.name,
      email: row.email || undefined,
      avatarUrl: row.avatarUrl || undefined,
      role: row.role,
      joinedAt: row.joinedAt,
      isAudioMuted: row.isAudioMuted === 1,
      isVideoMuted: row.isVideoMuted === 1,
      isScreenSharing: row.isScreenSharing === 1,
      isHandRaised: row.isHandRaised === 1,
      handRaisedAt: row.handRaisedAt || undefined,
      currentBreakoutRoomId: row.currentBreakoutRoomId || null,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  private mapRecordingRow(row: any): Recording {
    return {
      id: row.id,
      roomId: row.roomId,
      status: row.status,
      startedAt: row.startedAt,
      stoppedAt: row.stoppedAt || undefined,
      durationSeconds: row.durationSeconds || undefined,
      fileSizeBytes: row.fileSizeBytes || undefined,
      fileUrl: row.fileUrl || undefined,
      storageKey: row.storageKey || undefined,
      downloadUrl: row.downloadUrl || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      error: row.error || undefined
    };
  }

  private mapBreakoutRow(row: any): BreakoutRoom {
    return {
      id: row.id,
      parentRoomId: row.parentRoomId,
      name: row.name,
      participantIds: JSON.parse(row.participantIds),
      createdAt: row.createdAt,
      durationMinutes: row.durationMinutes || undefined,
      isActive: row.isActive === 1
    };
  }
}
