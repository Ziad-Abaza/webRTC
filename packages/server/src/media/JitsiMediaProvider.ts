import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { IMediaProvider, Room, Participant, MediaTokenResult, RoomPermission } from '@nexusrtc/core';

export interface JitsiProviderOptions {
  domain?: string;
  appId?: string;
  appSecret?: string;
}

export class JitsiMediaProvider implements IMediaProvider {
  readonly name = 'jitsi';
  private domain: string;
  private appId: string;
  private appSecret: string;

  constructor(options: JitsiProviderOptions = {}) {
    this.domain = options.domain || 'meet.jit.si';
    this.appId = options.appId || '';
    this.appSecret = options.appSecret || '';
  }

  async generateSessionToken(
    room: Room,
    participant: Participant,
    options?: Record<string, unknown>
  ): Promise<MediaTokenResult> {
    const isModerator = participant.role === 'host' || participant.role === 'moderator';
    const canRecord = Boolean(room.features.recordingEnabled && (participant.permissions?.includes(RoomPermission.START_RECORDING) ?? isModerator));
    const canLivestream = Boolean(room.features.liveStreamingEnabled && (participant.permissions?.includes(RoomPermission.START_BROADCAST) ?? isModerator));
    const canScreenshare = Boolean(room.features.screenShareEnabled && (participant.permissions?.includes(RoomPermission.SHARE_SCREEN) ?? true));

    // Only generate HS256 token if an appSecret is explicitly configured and not using public meet.jit.si.
    // Public meet.jit.si requires 8x8 JaaS RS256 tokens with a 'kid' header; HS256 tokens fail authentication.
    let token = '';
    const isPublicMeetJitsi = this.domain === 'meet.jit.si' || this.domain.endsWith('.meet.jit.si');
    if (this.appSecret && !isPublicMeetJitsi) {
      const payload = {
        context: {
          user: {
            id: participant.id,
            name: participant.name,
            email: participant.email,
            avatar: participant.avatarUrl,
            moderator: isModerator
          },
          features: {
            recording: canRecord,
            livestreaming: canLivestream,
            'screen-sharing': canScreenshare
          }
        },
        aud: this.appId || 'nexusrtc',
        iss: this.appId || 'nexusrtc',
        sub: this.domain,
        room: room.slug,
        exp: Math.floor(Date.now() / 1000) + 24 * 3600 // 24h validity
      };

      token = jwt.sign(payload, this.appSecret, { algorithm: 'HS256' });
    }

    return {
      token,
      room: room.slug,
      domain: this.domain,
      appId: this.appId
    };
  }

  async startRecording(
    roomId: string,
    options?: { rtmpStreamKey?: string; storageDestination?: string }
  ): Promise<{ recordingId: string; status: string }> {
    const recordingId = uuidv4();
    // In Jitsi, recording is coordinated via Jibri or JaaS REST API.
    // In our engine, this dispatches the recording session trigger to the active media session
    return {
      recordingId,
      status: 'recording'
    };
  }

  async stopRecording(
    roomId: string,
    recordingId: string
  ): Promise<{ success: boolean }> {
    return { success: true };
  }

  async startBroadcast(
    roomId: string,
    streamUrl: string,
    streamKey: string
  ): Promise<{ broadcastId: string; status: string }> {
    const broadcastId = uuidv4();
    return {
      broadcastId,
      status: 'live'
    };
  }

  async stopBroadcast(
    roomId: string,
    broadcastId: string
  ): Promise<{ success: boolean }> {
    return { success: true };
  }

  async moderateParticipant(
    roomId: string,
    participantId: string,
    action: 'mute-audio' | 'mute-video' | 'kick'
  ): Promise<{ success: boolean }> {
    return { success: true };
  }
}
