import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import {
  NexusEvents,
  ChatMessage,
  Participant,
  JoinedResponse,
  AuthTokenPayload,
  RoomPermission,
  resolveEffectivePermissions,
  RoomPermissionsConfig
} from '@nexusrtc/core';
import { RoomService } from '../services/RoomService.js';
import { RecordingService } from '../services/RecordingService.js';
import { BreakoutService } from '../services/BreakoutService.js';
import { BroadcastService } from '../services/BroadcastService.js';
import { IDatabaseAdapter } from '@nexusrtc/core';

interface ClientConnection {
  ws: WebSocket;
  participant: Participant;
  roomSlug: string;
  roomId: string;
}

export class WebSocketSignalingServer {
  private wss: WebSocketServer;
  // Map of roomId -> Map of participantId -> ClientConnection
  private rooms = new Map<string, Map<string, ClientConnection>>();

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

  private init() {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      let clientSession: ClientConnection | null = null;

      ws.on('message', async (data: Buffer | string) => {
        try {
          const message = JSON.parse(data.toString());
          const { event, payload } = message;

          switch (event) {
            case NexusEvents.JOIN: {
              const { token } = payload;
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
                metadata: auth.metadata
              };

              await this.db.addParticipant(room.id, participant);

              clientSession = {
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
              roomClients.set(participant.id, clientSession);

              // Gather current room state
              const allParticipants = await this.db.listParticipants(room.id);
              const breakoutRooms = await this.breakoutService.listBreakoutRooms(room.id);
              const recordings = await this.recordingService.listRecordings(room.id);
              const activeRecording = recordings.find((r) => r.status === 'recording') || null;
              const broadcast = await this.broadcastService.getBroadcast(room.id);

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
                  token: '',
                  domain: 'meet.jit.si',
                  room: room.slug
                },
                activeBreakoutRooms: breakoutRooms,
                activeRecording,
                activeBroadcast: broadcast
              };

              ws.send(JSON.stringify({ event: NexusEvents.JOINED, payload: joinResponse }));

              // Broadcast to other participants in the room
              this.broadcastToRoom(room.id, NexusEvents.PARTICIPANT_JOINED, participant, participant.id);
              break;
            }

            case NexusEvents.MEDIA_STATE_CHANGED: {
              if (!clientSession) return;
              const { isAudioMuted, isVideoMuted, isScreenSharing } = payload;
              const room = await this.roomService.getRoom(clientSession.roomId);

              // Authoritative capability checks
              if (isAudioMuted === false && !this.hasPermission(clientSession, RoomPermission.SEND_AUDIO, room?.permissions)) {
                ws.send(JSON.stringify({
                  event: NexusEvents.ERROR,
                  payload: { message: 'Permission denied: unmuting audio is not permitted for your role' }
                }));
                return;
              }

              if (isVideoMuted === false && !this.hasPermission(clientSession, RoomPermission.SEND_VIDEO, room?.permissions)) {
                ws.send(JSON.stringify({
                  event: NexusEvents.ERROR,
                  payload: { message: 'Permission denied: starting video is not permitted for your role' }
                }));
                return;
              }

              if (isScreenSharing === true && !this.hasPermission(clientSession, RoomPermission.SHARE_SCREEN, room?.permissions)) {
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

              if (isHandRaised && !this.hasPermission(clientSession, RoomPermission.RAISE_HAND, room?.permissions)) {
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
              if (!this.hasPermission(clientSession, requiredPerm, room?.permissions)) {
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
              const { targetParticipantId, action } = payload;

              if (action === 'kick') {
                if (!this.hasPermission(clientSession, RoomPermission.KICK_PARTICIPANTS, room?.permissions)) {
                  ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to kick participants' } }));
                  return;
                }
                this.sendToParticipant(clientSession.roomId, targetParticipantId, NexusEvents.PARTICIPANT_MODERATED, {
                  action: 'kick',
                  by: clientSession.participant.name
                });
                const targetSession = this.getParticipantSession(clientSession.roomId, targetParticipantId);
                if (targetSession) {
                  targetSession.ws.close();
                }
              } else if (action === 'mute-audio' || action === 'mute-video') {
                if (!this.hasPermission(clientSession, RoomPermission.MUTE_OTHERS, room?.permissions)) {
                  ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to mute other participants' } }));
                  return;
                }
                const updates = action === 'mute-audio' ? { isAudioMuted: true } : { isVideoMuted: true };
                await this.db.updateParticipant(clientSession.roomId, targetParticipantId, updates);
                this.broadcastToRoom(clientSession.roomId, NexusEvents.PARTICIPANT_MODERATED, {
                  participantId: targetParticipantId,
                  action
                });
              }
              break;
            }

            case NexusEvents.UPDATE_PERMISSIONS: {
              if (!clientSession) return;
              const room = await this.roomService.getRoom(clientSession.roomId);
              if (!this.hasPermission(clientSession, RoomPermission.UPDATE_ROOM_PERMISSIONS, room?.permissions)) {
                ws.send(JSON.stringify({ event: NexusEvents.ERROR, payload: { message: 'Unauthorized to update room permissions' } }));
                return;
              }

              const { permissions, locks } = payload;
              const updatedRoom = await this.roomService.updateRoomPermissions(clientSession.roomId, {
                ...permissions,
                locks: locks || permissions?.locks
              });

              // Re-evaluate permissions for all currently connected participants in the room
              const roomClients = this.rooms.get(clientSession.roomId);
              if (roomClients) {
                for (const [pId, client] of roomClients.entries()) {
                  const effectiveSet = resolveEffectivePermissions(
                    client.participant.role,
                    pId,
                    updatedRoom.permissions
                  );
                  client.participant.permissions = Array.from(effectiveSet);
                  // Notify client of their new effective permissions
                  client.ws.send(JSON.stringify({
                    event: NexusEvents.PERMISSIONS_UPDATED,
                    payload: {
                      participantId: pId,
                      permissions: client.participant.permissions,
                      locks: updatedRoom.permissions?.locks
                    }
                  }));

                  // If microphones were locked globally, force mute audio
                  if (updatedRoom.permissions?.locks?.lockMicrophones && client.participant.role !== 'host') {
                    await this.db.updateParticipant(clientSession.roomId, pId, { isAudioMuted: true });
                    client.participant.isAudioMuted = true;
                  }

                  // If cameras were locked globally, force mute video
                  if (updatedRoom.permissions?.locks?.lockCameras && client.participant.role !== 'host') {
                    await this.db.updateParticipant(clientSession.roomId, pId, { isVideoMuted: true });
                    client.participant.isVideoMuted = true;
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
              if (!this.hasPermission(clientSession, RoomPermission.CREATE_BREAKOUT, room?.permissions)) {
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
              if (!this.hasPermission(clientSession, RoomPermission.JOIN_BREAKOUT, room?.permissions)) {
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
              if (!this.hasPermission(clientSession, RoomPermission.BROADCAST_BREAKOUT, room?.permissions)) {
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
              if (!this.hasPermission(clientSession, RoomPermission.START_RECORDING, room?.permissions)) {
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
              if (!this.hasPermission(clientSession, RoomPermission.STOP_RECORDING, room?.permissions)) {
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
              if (!this.hasPermission(clientSession, RoomPermission.START_BROADCAST, room?.permissions)) {
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
              if (!this.hasPermission(clientSession, RoomPermission.STOP_BROADCAST, room?.permissions)) return;
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
          const { roomId, participant } = clientSession;
          const roomClients = this.rooms.get(roomId);
          if (roomClients) {
            roomClients.delete(participant.id);
            if (roomClients.size === 0) {
              this.rooms.delete(roomId);
            }
          }

          try {
            await this.db.removeParticipant(roomId, participant.id);
          } catch {
            // Database might be closed during shutdown
          }
          this.broadcastToRoom(roomId, NexusEvents.PARTICIPANT_LEFT, { participantId: participant.id });
        }
      });
    });
  }

  private broadcastToRoom(roomId: string, event: NexusEvents, payload: unknown, excludeParticipantId?: string) {
    const roomClients = this.rooms.get(roomId);
    if (!roomClients) return;

    const data = JSON.stringify({ event, payload });
    for (const [pId, client] of roomClients.entries()) {
      if (excludeParticipantId && pId === excludeParticipantId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  private sendToParticipant(roomId: string, participantId: string, event: NexusEvents, payload: unknown) {
    const client = this.getParticipantSession(roomId, participantId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ event, payload }));
    }
  }

  private getParticipantSession(roomId: string, participantId: string): ClientConnection | undefined {
    const roomClients = this.rooms.get(roomId);
    return roomClients?.get(participantId);
  }

  private hasPermission(client: ClientConnection, permission: RoomPermission, roomPermissions?: RoomPermissionsConfig): boolean {
    const effective = resolveEffectivePermissions(
      client.participant.role,
      client.participant.id,
      roomPermissions
    );
    return effective.has(permission);
  }
}
