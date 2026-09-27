import { EventEmitter } from './EventEmitter.js';
import { MediaManager } from './MediaManager.js';
import { ChatManager } from './ChatManager.js';
import { BreakoutManager } from './BreakoutManager.js';
import {
  NexusEvents,
  Participant,
  JoinedResponse,
  Recording,
  LiveBroadcastConfig,
  BreakoutRoom,
  ChatMessage
} from '@nexusrtc/core';

export interface NexusClientOptions {
  wsUrl: string;
  token: string;
  autoConnect?: boolean;
}

export class NexusClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private token: string;
  private joinedData: JoinedResponse | null = null;
  private participantsMap = new Map<string, Participant>();

  public media: MediaManager;
  public chat: ChatManager;
  public breakout: BreakoutManager;

  constructor(options: NexusClientOptions) {
    super();
    this.wsUrl = options.wsUrl;
    this.token = options.token;

    const sendSocket = (event: NexusEvents, payload: any) => this.send(event, payload);
    this.media = new MediaManager(sendSocket);
    this.chat = new ChatManager(sendSocket);
    this.breakout = new BreakoutManager(sendSocket);

    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  connect(): Promise<JoinedResponse> {
    return new Promise((resolve, reject) => {
      try {
        const WebSocketClass = typeof window !== 'undefined' ? window.WebSocket : (globalThis as any).WebSocket;
        if (!WebSocketClass) {
          throw new Error('No WebSocket implementation found in runtime environment');
        }

        this.ws = new WebSocketClass(this.wsUrl);

        this.ws!.onopen = () => {
          this.emit('connected');
          // Send Join handshake
          this.send(NexusEvents.JOIN, { token: this.token });
        };

        this.ws!.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
            this.handleSocketEvent(data.event, data.payload, resolve);
          } catch (err) {
            console.error('[NexusClient] Failed to parse message', err);
          }
        };

        this.ws!.onerror = (err: any) => {
          this.emit('error', err);
        };

        this.ws!.onclose = () => {
          this.emit('disconnected');
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleSocketEvent(event: NexusEvents, payload: any, joinResolve?: (val: JoinedResponse) => void): void {
    switch (event) {
      case NexusEvents.JOINED: {
        this.joinedData = payload as JoinedResponse;
        this.participantsMap.clear();
        for (const p of this.joinedData.participants) {
          this.participantsMap.set(p.id, p);
        }
        if (this.joinedData.activeBreakoutRooms) {
          this.breakout.setInitialBreakouts(this.joinedData.activeBreakoutRooms);
        }
        if (joinResolve) {
          joinResolve(this.joinedData);
        }
        this.emit('joined', this.joinedData);
        break;
      }

      case NexusEvents.PARTICIPANT_JOINED: {
        const participant = payload as Participant;
        this.participantsMap.set(participant.id, participant);
        this.emit('participantJoined', participant);
        this.emit('participantsChanged', this.getParticipants());
        break;
      }

      case NexusEvents.PARTICIPANT_LEFT: {
        const { participantId } = payload;
        const p = this.participantsMap.get(participantId);
        this.participantsMap.delete(participantId);
        this.emit('participantLeft', { participantId, participant: p });
        this.emit('participantsChanged', this.getParticipants());
        break;
      }

      case NexusEvents.MEDIA_STATE_CHANGED: {
        const { participantId, isAudioMuted, isVideoMuted, isScreenSharing } = payload;
        const p = this.participantsMap.get(participantId);
        if (p) {
          if (typeof isAudioMuted === 'boolean') p.isAudioMuted = isAudioMuted;
          if (typeof isVideoMuted === 'boolean') p.isVideoMuted = isVideoMuted;
          if (typeof isScreenSharing === 'boolean') p.isScreenSharing = isScreenSharing;
          this.emit('participantMediaChanged', p);
        }
        break;
      }

      case NexusEvents.HAND_RAISED: {
        const { participantId } = payload;
        const p = this.participantsMap.get(participantId);
        if (p) {
          p.isHandRaised = true;
          this.emit('handRaised', p);
        }
        break;
      }

      case NexusEvents.HAND_LOWERED: {
        const { participantId } = payload;
        const p = this.participantsMap.get(participantId);
        if (p) {
          p.isHandRaised = false;
          this.emit('handLowered', p);
        }
        break;
      }

      case NexusEvents.CHAT_RECEIVED: {
        const msg = payload as ChatMessage;
        this.chat.handleIncomingMessage(msg);
        this.emit('chatMessage', msg);
        break;
      }

      case NexusEvents.BREAKOUT_CREATED: {
        this.breakout.handleBreakoutCreated(payload as BreakoutRoom);
        break;
      }

      case NexusEvents.BREAKOUT_UPDATED: {
        this.breakout.handleBreakoutUpdated(payload as BreakoutRoom);
        break;
      }

      case NexusEvents.BREAKOUT_BROADCAST: {
        this.emit('breakoutBroadcast', payload);
        break;
      }

      case NexusEvents.RECORDING_STATE_CHANGED: {
        const recording = payload as Recording;
        this.emit('recordingStateChanged', recording);
        break;
      }

      case NexusEvents.BROADCAST_STATE_CHANGED: {
        const broadcast = payload as LiveBroadcastConfig;
        this.emit('broadcastStateChanged', broadcast);
        break;
      }

      case NexusEvents.PARTICIPANT_MODERATED: {
        this.emit('moderated', payload);
        break;
      }

      case NexusEvents.PERMISSIONS_UPDATED: {
        const { participantId, permissions } = payload;
        const self = this.getSelf();
        if (self && self.id === participantId) {
          self.permissions = permissions;
        }
        const p = this.participantsMap.get(participantId);
        if (p) {
          p.permissions = permissions;
        }
        this.emit('permissionsUpdated', payload);
        break;
      }

      case NexusEvents.LOCKS_CHANGED: {
        this.emit('locksChanged', payload);
        break;
      }

      case NexusEvents.ERROR: {
        this.emit('error', payload);
        break;
      }

      default:
        break;
    }
  }

  public send(event: NexusEvents, payload: any): void {
    if (this.ws && this.ws.readyState === (this.ws.OPEN ?? 1)) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }

  // Permissions & Capabilities
  hasPermission(permission: string): boolean {
    const self = this.getSelf();
    if (!self || !self.permissions) return false;
    return self.permissions.includes(permission as any);
  }

  getEffectivePermissions(): string[] {
    const self = this.getSelf();
    return (self?.permissions as string[]) || [];
  }

  updateRoomPermissions(permissions: any, locks?: any): void {
    this.send(NexusEvents.UPDATE_PERMISSIONS, { permissions, locks });
  }

  // Raise Hand
  toggleRaiseHand(): void {
    const self = this.getSelf();
    const newState = self ? !self.isHandRaised : true;
    if (self) self.isHandRaised = newState;
    this.send(NexusEvents.HAND_RAISED, { isHandRaised: newState });
  }

  // Recording
  startRecording(): void {
    this.send(NexusEvents.RECORDING_START, {});
  }

  stopRecording(): void {
    this.send(NexusEvents.RECORDING_STOP, {});
  }

  // Live Broadcast
  startBroadcast(streamUrl: string, streamKey: string): void {
    this.send(NexusEvents.BROADCAST_START, { streamUrl, streamKey });
  }

  stopBroadcast(): void {
    this.send(NexusEvents.BROADCAST_STOP, {});
  }

  // Moderation
  moderateParticipant(targetParticipantId: string, action: 'mute-audio' | 'mute-video' | 'kick'): void {
    this.send(NexusEvents.MODERATE_PARTICIPANT, { targetParticipantId, action });
  }

  // State accessors
  getSelf(): Participant | null {
    return this.joinedData?.self || null;
  }

  getParticipants(): Participant[] {
    return Array.from(this.participantsMap.values());
  }

  getRoomDetails(): JoinedResponse['room'] | null {
    return this.joinedData?.room || null;
  }

  getMediaDetails(): JoinedResponse['media'] | null {
    return this.joinedData?.media || null;
  }

  disconnect(): void {
    this.media.dispose();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.removeAllListeners();
  }
}
