import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
  NexusEvents,
  WebRTCEvents,
  ChatMessage,
  Participant,
  Room,
  JoinedResponse,
  AuthTokenPayload,
  RoomPermission,
  resolveEffectivePermissions,
  RoomPermissionsConfig,
  canModerateParticipant
} from '@webrtc/core';
import { RoomService } from '../services/RoomService.js';
import { RecordingService } from '../services/RecordingService.js';
import { BreakoutService } from '../services/BreakoutService.js';
import { BroadcastService } from '../services/BroadcastService.js';
import { IDatabaseAdapter } from '@webrtc/core';

interface ClientConnection {
  connectionId: string;
  ws: WebSocket;
  participant: Participant;
  roomSlug: string;
  roomId: string;
}

export class WebSocketSignalingServer {
  private wss: WebSocketServer;
  // Map of roomId -> Map of participantId -> Map of connectionId -> ClientConnection
  private rooms = new Map<string, Map<string, Map<string, ClientConnection>>>();
  // Track message rates per socket to mitigate flooding/abuse
  private messageCounts = new WeakMap<WebSocket, { count: number; resetAt: number }>();

  constructor(
    wss: WebSocketServer,
    private roomService: RoomService,
    private db: IDatabaseAdapter,
    private recordingService: RecordingService,
    private breakoutService: BreakoutService,
    private broadcastService: BroadcastService
  ) {
    this.wss = wss;
    this.init();
  }

  private isRateLimited(ws: WebSocket): boolean {
    const now = Date.now();
    let stats = this.messageCounts.get(ws);
    if (!stats || now > stats.resetAt) {
      stats = { count: 1, resetAt: now + 1000 };
      this.messageCounts.set(ws, stats);
      return false;
    }
    stats.count++;
    // Maximum 50 signaling messages per second per client
    return stats.count > 50;
  }

  private init() {
    this.wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
      let clientSession: ClientConnection | null = null;

      ws.on('message', async (data: Buffer | string) => {
        try {
          if (this.isRateLimited(ws)) {
            ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Rate limit exceeded' } }));
            return;
          }

          const rawStr = data.toString();
          if (rawStr.length > 65536) { // 64KB max signaling payload
            ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Payload exceeds maximum allowed size' } }));
            return;
          }

          const message = JSON.parse(rawStr);
          const { event, payload } = message;
          const normalizedEvent = typeof event === 'string' ? event.replace(/^nexus:/, 'webrtc:') : event;

          switch (normalizedEvent) {
            case NexusEvents.JOIN: {
              if (clientSession) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Session already joined on this connection' } }));
                return;
              }

              const { token } = payload || {};
              if (!token || typeof token !== 'string') {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Missing token' } }));
                ws.close();
                return;
              }

              let auth: AuthTokenPayload;
              try {
                auth = this.roomService.verifyJoinToken(token);
              } catch (err) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Invalid or expired token' } }));
                ws.close();
                return;
              }

              const room = await this.roomService.getRoom(auth.roomId);
              if (!room || room.status !== 'active') {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Room not found or closed' } }));
                ws.close();
                return;
              }

              // Authoritative eviction check: evicted/banned participant cannot rejoin
              if (room.permissions?.bannedParticipantIds?.includes(auth.sub)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Participant has been evicted from this session' } }));
                ws.close();
                return;
              }

              // Compute effective permissions authoritatively
              const effectiveSet = resolveEffectivePermissions(auth.role, auth.sub, room.permissions, room.features);

              const participant: Participant = {
                id: auth.sub,
                name: auth.name,
                email: auth.email,
                role: auth.role,
                joinedAt: Date.now(),
                isAudioMuted: true,
                isVideoMuted: true,
                isScreenSharing: false,
                isHandRaised: false,
                permissions: Array.from(effectiveSet),
                metadata: auth.metadata
              };

              const connectionId = uuidv4();
              clientSession = {
                connectionId,
                ws,
                participant,
                roomId: room.id,
                roomSlug: room.slug
              };

              let roomClients = this.rooms.get(room.id);
              if (!roomClients) {
                roomClients = new Map();
                this.rooms.set(room.id, roomClients);
              }
              let userConns = roomClients.get(participant.id);
              const isFirstConnection = !userConns || userConns.size === 0;
              if (!userConns) {
                userConns = new Map();
                roomClients.set(participant.id, userConns);
              }
              userConns.set(connectionId, clientSession);

              if (isFirstConnection) {
                await this.db.addParticipant(room.id, participant);
              }

              // Gather current room state
              const allParticipants = await this.db.listParticipants(room.id);
              const breakoutRooms = await this.breakoutService.listBreakoutRooms(room.id);
              const recordings = await this.recordingService.listRecordings(room.id);
              const activeRecording = recordings.find((r) => r.status === 'recording') || null;
              const broadcast = await this.broadcastService.getBroadcast(room.id);
              const mediaSession = await this.roomService.mediaProvider.generateSessionToken(room, participant);

              const joinResponse: JoinedResponse = {
                room: {
                  id: room.id,
                  slug: room.slug,
                  title: room.title,
                  features: room.features as unknown as Record<string, unknown>
                },
                self: participant,
                participants: allParticipants,
                media: {
                  provider: room.mediaProvider,
                  ...mediaSession
                },
                activeBreakoutRooms: breakoutRooms,
                activeRecording,
                activeBroadcast: broadcast
              };

              ws.send(JSON.stringify({ event: NexusEvents.JOINED, payload: joinResponse }));

              // Broadcast to other participants in the room only on first socket join
              if (isFirstConnection) {
                this.broadcastToRoom(room.id, NexusEvents.PARTICIPANT_JOINED, participant, participant.id);
              }
              break;
            }

            case NexusEvents.MEDIA_STATE_CHANGED: {
              if (!clientSession) return;
              const { isAudioMuted, isVideoMuted, isScreenSharing } = payload;
              const room = await this.roomService.getRoom(clientSession.roomId);

              // Authoritative capability checks
              if (isAudioMuted === false && !this.hasPermission(clientSession, RoomPermission.SEND_AUDIO, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({
                  event: NexusEvents.ERROR,
                  payload: { message: 'Permission denied: unmuting audio is not permitted for your role' }
                }));
                return;
              }

              if (isVideoMuted === false && !this.hasPermission(clientSession, RoomPermission.SEND_VIDEO, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({
                  event: NexusEvents.ERROR,
                  payload: { message: 'Permission denied: starting video is not permitted for your role' }
                }));
                return;
              }

              if (isScreenSharing === true && !this.hasPermission(clientSession, RoomPermission.SHARE_SCREEN, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({
                  event: NexusEvents.ERROR,
                  payload: { message: 'Permission denied: screen sharing is not permitted for your role' }
                }));
                return;
              }

              const updates: Partial<Participant> = {};
              if (typeof isAudioMuted === 'boolean') updates.isAudioMuted = isAudioMuted;
              if (typeof isVideoMuted === 'boolean') updates.isVideoMuted = isVideoMuted;
              if (typeof isScreenSharing === 'boolean') updates.isScreenSharing = isScreenSharing;

              const updated = await this.db.updateParticipant(clientSession.roomId, clientSession.participant.id, updates);
              clientSession.participant = updated;

              this.broadcastToRoom(clientSession.roomId, NexusEvents.MEDIA_STATE_CHANGED, {
                participantId: updated.id,
                ...updates
              });

              if (typeof isScreenSharing === 'boolean') {
                const screenEvent = isScreenSharing ? NexusEvents.SCREEN_SHARE_STARTED : NexusEvents.SCREEN_SHARE_STOPPED;
                this.broadcastToRoom(clientSession.roomId, screenEvent, {
                  participantId: updated.id,
                  participantName: updated.name
                });
              }
              break;
            }

            case NexusEvents.HAND_RAISED: {
              if (!clientSession) return;
              const isHandRaised = payload?.isHandRaised ?? true;
              const room = await this.roomService.getRoom(clientSession.roomId);

              if (isHandRaised && !this.hasPermission(clientSession, RoomPermission.RAISE_HAND, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({
                  event: NexusEvents.ERROR,
                  payload: { message: 'Permission denied: raising hand is not permitted for your role' }
                }));
                return;
              }

              const updated = await this.db.updateParticipant(clientSession.roomId, clientSession.participant.id, {
                isHandRaised,
                handRaisedAt: isHandRaised ? Date.now() : undefined
              });
              clientSession.participant = updated;

              const eventType = isHandRaised ? NexusEvents.HAND_RAISED : NexusEvents.HAND_LOWERED;
              this.broadcastToRoom(clientSession.roomId, eventType, {
                participantId: updated.id,
                participantName: updated.name,
                isHandRaised,
                handRaisedAt: updated.handRaisedAt
              });
              break;
            }

            case NexusEvents.CHAT_SEND: {
              if (!clientSession) return;
              const { content, recipientId } = payload;
              if (!content || typeof content !== 'string') return;
              const room = await this.roomService.getRoom(clientSession.roomId);

              const requiredPerm = recipientId ? RoomPermission.SEND_PRIVATE_CHAT : RoomPermission.SEND_CHAT;
              if (!this.hasPermission(clientSession, requiredPerm, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({
                  event: NexusEvents.ERROR,
                  payload: { message: `Permission denied: ${recipientId ? 'private' : 'room'} chat is disabled for your role` }
                }));
                return;
              }

              const chatMsg: ChatMessage = {
                id: uuidv4(),
                roomId: clientSession.roomId,
                senderId: clientSession.participant.id,
                senderName: clientSession.participant.name,
                senderRole: clientSession.participant.role,
                content,
                timestamp: Date.now(),
                isPrivate: !!recipientId,
                recipientId
              };

              await this.db.saveChatMessage(chatMsg);

              if (recipientId) {
                // Direct private message
                this.sendToParticipant(clientSession.roomId, recipientId, NexusEvents.CHAT_RECEIVED, chatMsg);
                // Also send back to sender
                ws.send(JSON.stringify({ event: NexusEvents.CHAT_RECEIVED, payload: chatMsg }));
              } else {
                // Broadcast to all participants in the room
                this.broadcastToRoom(clientSession.roomId, NexusEvents.CHAT_RECEIVED, chatMsg);
              }
              break;
            }

            case NexusEvents.MODERATE_PARTICIPANT: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!room) return;
              const { targetParticipantId, action } = payload || {};

              if (!targetParticipantId || typeof targetParticipantId !== 'string') {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Missing target participant ID' } }));
                return;
              }

              // Check required capability first
              if (action === 'kick') {
                if (!this.hasPermission(clientSession, RoomPermission.KICK_PARTICIPANTS, room.permissions, room.features)) {
                  ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to kick participants' } }));
                  return;
                }
              } else if (action === 'mute-audio' || action === 'mute-video') {
                if (!this.hasPermission(clientSession, RoomPermission.MUTE_OTHERS, room.permissions, room.features)) {
                  ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to mute other participants' } }));
                  return;
                }
              } else {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: `Unsupported moderation action: ${action}` } }));
                return;
              }

              // Authoritative rule: The room host (by hostId or role) can NEVER be moderated or kicked by anyone
              if (targetParticipantId === room.hostId) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Cannot moderate or kick the room host' } }));
                return;
              }

              // Look up target participant authoritatively
              let target = this.getParticipant(clientSession.roomId, targetParticipantId);
              if (!target) {
                target = await this.db.getParticipant(clientSession.roomId, targetParticipantId);
              }
              if (!target) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Target participant not found' } }));
                return;
              }

              // Authoritatively verify role hierarchy and immunity
              const authCheck = canModerateParticipant(
                clientSession.participant.role,
                clientSession.participant.id,
                target.role,
                target.id,
                room.hostId
              );
              if (!authCheck.allowed) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: authCheck.reason || 'Unauthorized to moderate participant' } }));
                return;
              }

              if (action === 'kick') {
                // Authoritatively ban participant so token cannot be replayed
                await this.roomService.banParticipant(clientSession.roomId, targetParticipantId);

                this.sendToParticipant(clientSession.roomId, targetParticipantId, NexusEvents.PARTICIPANT_MODERATED, {
                  targetParticipantId,
                  action: 'kick',
                  by: clientSession.participant.name
                });

                // Close all active sockets for target participant
                const targetConns = this.getParticipantConnections(clientSession.roomId, targetParticipantId);
                for (const tConn of targetConns) {
                  tConn.ws.close();
                }

                // Cleanup target from room clients
                const roomClients = this.rooms.get(clientSession.roomId);
                roomClients?.delete(targetParticipantId);

                await this.db.removeParticipant(clientSession.roomId, targetParticipantId);
                this.broadcastToRoom(clientSession.roomId, NexusEvents.PARTICIPANT_LEFT, { participantId: targetParticipantId });
              } else if (action === 'mute-audio' || action === 'mute-video') {
                const updates = action === 'mute-audio' ? { isAudioMuted: true } : { isVideoMuted: true };
                await this.db.updateParticipant(clientSession.roomId, targetParticipantId, updates);

                const targetConns = this.getParticipantConnections(clientSession.roomId, targetParticipantId);
                for (const tConn of targetConns) {
                  if (action === 'mute-audio') tConn.participant.isAudioMuted = true;
                  if (action === 'mute-video') tConn.participant.isVideoMuted = true;
                }

                this.broadcastToRoom(clientSession.roomId, NexusEvents.PARTICIPANT_MODERATED, {
                  targetParticipantId,
                  action,
                  by: clientSession.participant.name
                });
                this.broadcastToRoom(clientSession.roomId, NexusEvents.MEDIA_STATE_CHANGED, {
                  participantId: targetParticipantId,
                  ...updates
                });
              }
              break;
            }

            case NexusEvents.UPDATE_PERMISSIONS: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!room) return;
              if (!this.hasPermission(clientSession, RoomPermission.UPDATE_ROOM_PERMISSIONS, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to update room permissions' } }));
                return;
              }

              const { permissions, locks } = payload || {};
              const isCallerHost = clientSession.participant.role === 'host' || clientSession.participant.id === room.hostId;

              // Non-hosts can ONLY update dynamic locks, never role permissions or participant overrides
              if (!isCallerHost && (permissions?.roles || permissions?.participantOverrides)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Forbidden: Only room host can modify role capabilities or participant overrides' } }));
                return;
              }

              const permissionsUpdate: RoomPermissionsConfig = isCallerHost
                ? {
                    ...permissions,
                    locks: locks || permissions?.locks
                  }
                : {
                    locks: locks || permissions?.locks
                  };

              const updatedRoom = await this.roomService.updateRoomPermissions(clientSession.roomId, permissionsUpdate);

              // Re-evaluate permissions for all currently connected participants in the room
              const roomClients = this.rooms.get(clientSession.roomId);
              if (roomClients) {
                for (const [pId, userConns] of roomClients.entries()) {
                  for (const conn of userConns.values()) {
                    const effectiveSet = resolveEffectivePermissions(
                      conn.participant.role,
                      pId,
                      updatedRoom.permissions,
                      updatedRoom.features
                    );
                    conn.participant.permissions = Array.from(effectiveSet);
                    // Notify client of their new effective permissions
                    conn.ws.send(JSON.stringify({
                      event: NexusEvents.PERMISSIONS_UPDATED,
                      payload: {
                        participantId: pId,
                        permissions: conn.participant.permissions,
                        locks: updatedRoom.permissions?.locks
                      }
                    }));

                    // If microphones were locked globally, force mute audio
                    if (updatedRoom.permissions?.locks?.lockMicrophones && conn.participant.role !== 'host') {
                      await this.db.updateParticipant(clientSession.roomId, pId, { isAudioMuted: true });
                      conn.participant.isAudioMuted = true;
                    }

                    // If cameras were locked globally, force mute video
                    if (updatedRoom.permissions?.locks?.lockCameras && conn.participant.role !== 'host') {
                      await this.db.updateParticipant(clientSession.roomId, pId, { isVideoMuted: true });
                      conn.participant.isVideoMuted = true;
                    }
                  }
                }
              }

              this.broadcastToRoom(clientSession.roomId, NexusEvents.LOCKS_CHANGED, {
                locks: updatedRoom.permissions?.locks
              });
              break;
            }

            case NexusEvents.BREAKOUT_CREATE: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!this.hasPermission(clientSession, RoomPermission.CREATE_BREAKOUT, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to create breakout rooms' } }));
                return;
              }

              const { name, durationMinutes } = payload;
              const breakout = await this.breakoutService.createBreakoutRoom(clientSession.roomId, name, durationMinutes);
              this.broadcastToRoom(clientSession.roomId, NexusEvents.BREAKOUT_CREATED, breakout);
              break;
            }

            case NexusEvents.BREAKOUT_JOIN: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!this.hasPermission(clientSession, RoomPermission.JOIN_BREAKOUT, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to join breakout rooms' } }));
                return;
              }

              const { breakoutRoomId } = payload;
              const updatedBreakout = await this.breakoutService.assignParticipant(breakoutRoomId, clientSession.participant.id);
              await this.db.updateParticipant(clientSession.roomId, clientSession.participant.id, {
                currentBreakoutRoomId: breakoutRoomId
              });
              this.broadcastToRoom(clientSession.roomId, NexusEvents.BREAKOUT_UPDATED, updatedBreakout);
              break;
            }

            case NexusEvents.BREAKOUT_LEAVE: {
              if (!clientSession) return;
              await this.db.updateParticipant(clientSession.roomId, clientSession.participant.id, {
                currentBreakoutRoomId: null
              });
              this.broadcastToRoom(clientSession.roomId, NexusEvents.BREAKOUT_UPDATED, {
                participantId: clientSession.participant.id,
                currentBreakoutRoomId: null
              });
              break;
            }

            case NexusEvents.BREAKOUT_BROADCAST: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!this.hasPermission(clientSession, RoomPermission.BROADCAST_BREAKOUT, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to broadcast to breakout rooms' } }));
                return;
              }
              // Host announcement sent across all breakout rooms
              this.broadcastToRoom(clientSession.roomId, NexusEvents.BREAKOUT_BROADCAST, {
                message: payload.message,
                from: clientSession.participant.name
              });
              break;
            }

            case NexusEvents.RECORDING_START: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!this.hasPermission(clientSession, RoomPermission.START_RECORDING, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to start recording' } }));
                return;
              }
              const rec = await this.recordingService.startRecording(clientSession.roomId);
              this.broadcastToRoom(clientSession.roomId, NexusEvents.RECORDING_STATE_CHANGED, rec);
              break;
            }

            case NexusEvents.RECORDING_STOP: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!this.hasPermission(clientSession, RoomPermission.STOP_RECORDING, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to stop recording' } }));
                return;
              }
              const active = (await this.recordingService.listRecordings(clientSession.roomId)).find(
                (r) => r.status === 'recording'
              );
              if (active) {
                const rec = await this.recordingService.stopRecording(active.id);
                this.broadcastToRoom(clientSession.roomId, NexusEvents.RECORDING_STATE_CHANGED, rec);
              }
              break;
            }

            case NexusEvents.BROADCAST_START: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!this.hasPermission(clientSession, RoomPermission.START_BROADCAST, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to start broadcasting' } }));
                return;
              }
              const b = await this.broadcastService.startBroadcast(clientSession.roomId, payload.streamUrl, payload.streamKey);
              this.broadcastToRoom(clientSession.roomId, NexusEvents.BROADCAST_STATE_CHANGED, b);
              break;
            }

            case NexusEvents.BROADCAST_STOP: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!this.hasPermission(clientSession, RoomPermission.STOP_BROADCAST, room?.permissions, room?.features)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to stop broadcast' } }));
                return;
              }
              const b = await this.broadcastService.stopBroadcast(clientSession.roomId);
              this.broadcastToRoom(clientSession.roomId, NexusEvents.BROADCAST_STATE_CHANGED, b);
              break;
            }

            default:
              break;
          }
        } catch (err: unknown) {
          console.error('[Signaling Server Error]', err);
        }
      });

      ws.on('close', async () => {
        if (clientSession) {
          const { roomId, participant, connectionId } = clientSession;
          const roomClients = this.rooms.get(roomId);
          if (roomClients) {
            const userConns = roomClients.get(participant.id);
            if (userConns) {
              userConns.delete(connectionId);
              if (userConns.size === 0) {
                roomClients.delete(participant.id);
                if (roomClients.size === 0) {
                  this.rooms.delete(roomId);
                }

                try {
                  await this.db.removeParticipant(roomId, participant.id);
                } catch {
                  // Database might be closed during shutdown
                }
                this.broadcastToRoom(roomId, NexusEvents.PARTICIPANT_LEFT, { participantId: participant.id });
              }
            }
          }
        }
      });
    });
  }

  private broadcastToRoom(roomId: string, event: NexusEvents, payload: unknown, excludeParticipantId?: string) {
    const roomClients = this.rooms.get(roomId);
    if (!roomClients) return;

    const data = JSON.stringify({ event, payload });
    for (const [pId, userConns] of roomClients.entries()) {
      if (excludeParticipantId && pId === excludeParticipantId) continue;
      for (const client of userConns.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(data);
        }
      }
    }
  }

  private sendToParticipant(roomId: string, participantId: string, event: NexusEvents, payload: unknown) {
    const conns = this.getParticipantConnections(roomId, participantId);
    const data = JSON.stringify({ event, payload });
    for (const client of conns) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  private getParticipantConnections(roomId: string, participantId: string): ClientConnection[] {
    const roomClients = this.rooms.get(roomId);
    const userConns = roomClients?.get(participantId);
    return userConns ? Array.from(userConns.values()) : [];
  }

  private getParticipant(roomId: string, participantId: string): Participant | null {
    const conns = this.getParticipantConnections(roomId, participantId);
    return conns.length > 0 ? conns[0].participant : null;
  }

  private hasPermission(
    client: ClientConnection,
    permission: RoomPermission,
    roomPermissions?: RoomPermissionsConfig,
    roomFeatures?: Partial<Room['features']>
  ): boolean {
    const effective = resolveEffectivePermissions(
      client.participant.role,
      client.participant.id,
      roomPermissions,
      roomFeatures
    );
    return effective.has(permission);
  }
}
