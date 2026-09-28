import { EventEmitter } from './EventEmitter.js';
import { NexusEvents } from '@nexusrtc/core';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
}

export interface MediaConfig {
  provider: string;
  domain: string;
  room: string;
  token?: string;
  role?: string;
  permissions?: string[];
  parentNode?: HTMLElement | string;
  width?: string | number;
  height?: string | number;
  configOverwrite?: Record<string, any>;
  interfaceConfigOverwrite?: Record<string, any>;
}

export class MediaManager extends EventEmitter {
  private jitsiApi: any = null;
  private isAudioMuted: boolean = true;
  private isVideoMuted: boolean = true;
  private isScreenSharing: boolean = false;

  constructor(private sendSocketMessage: (event: NexusEvents, payload: any) => void) {
    super();
  }

  async attachJitsi(container: HTMLElement, config: MediaConfig): Promise<void> {
    if (typeof window === 'undefined') return;

    // Load external Jitsi API script if not already present
    if (!window.JitsiMeetExternalAPI) {
      await this.loadScript(`https://${config.domain}/external_api.js`);
    }

    if (!window.JitsiMeetExternalAPI) {
      console.warn('JitsiMeetExternalAPI could not be loaded. Running in headless media mode.');
      return;
    }

    const isHost = config.role === 'host' || config.role === 'moderator';
    const perms = config.permissions || [];
    const hasPerm = (p: string) => perms.includes(p);

    const toolbarButtons = [
      'fullscreen', 'fodeviceselection', 'hangup', 'profile',
      'videoquality', 'filmstrip', 'feedback', 'stats', 'shortcuts',
      'tileview', 'videobackgroundblur', 'download', 'help'
    ];

    if (isHost || hasPerm('media:send_audio')) toolbarButtons.push('microphone');
    if (isHost || hasPerm('media:send_video')) toolbarButtons.push('camera');
    if (isHost || hasPerm('media:share_screen')) toolbarButtons.push('desktop');
    if (isHost || hasPerm('chat:send')) toolbarButtons.push('chat');
    if (isHost || hasPerm('interaction:raise_hand')) toolbarButtons.push('raisehand');
    
    // Host/moderator only controls - never exposed to regular invited participants
    if (isHost || hasPerm('session:start_recording')) toolbarButtons.push('recording');
    if (isHost || hasPerm('session:start_broadcast')) toolbarButtons.push('livestreaming');
    if (isHost || hasPerm('moderation:mute_others')) toolbarButtons.push('mute-everyone');
    if (isHost || hasPerm('session:update_permissions')) toolbarButtons.push('security');

    const options: any = {
      roomName: config.room,
      parentNode: container,
      ...(config.token ? { jwt: config.token } : {}),
      width: config.width || '100%',
      height: config.height || '100%',
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        remoteVideoMenu: {
          disableKick: !isHost,
          disableGrantModerator: !isHost,
          disablePrivateChat: !hasPerm('chat:send_private'),
        },
        disableRemoteMute: !isHost && !hasPerm('moderation:mute_others'),
        participantsPane: {
          hideMoreActionsButton: !isHost,
          hideMuteAllButton: !isHost && !hasPerm('moderation:mute_others'),
        },
        ...config.configOverwrite
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: toolbarButtons,
        ...config.interfaceConfigOverwrite
      }
    };

    this.jitsiApi = new window.JitsiMeetExternalAPI(config.domain, options);

    // Bind Jitsi events to Nexus sync
    this.jitsiApi.addEventListener('audioMuteStatusChanged', ({ muted }: { muted: boolean }) => {
      this.isAudioMuted = muted;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isAudioMuted: muted });
      this.emit('audioMuteChanged', muted);
    });

    this.jitsiApi.addEventListener('videoMuteStatusChanged', ({ muted }: { muted: boolean }) => {
      this.isVideoMuted = muted;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isVideoMuted: muted });
      this.emit('videoMuteChanged', muted);
    });

    this.jitsiApi.addEventListener('screenSharingStatusChanged', ({ on }: { on: boolean }) => {
      this.isScreenSharing = on;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isScreenSharing: on });
      this.emit('screenSharingChanged', on);
    });

    this.emit('ready');
  }

  toggleAudio(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleAudio');
    } else {
      this.isAudioMuted = !this.isAudioMuted;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isAudioMuted: this.isAudioMuted });
      this.emit('audioMuteChanged', this.isAudioMuted);
    }
  }

  muteAudio(force: boolean = true): void {
    if (this.jitsiApi) {
      if (force && !this.isAudioMuted) {
        this.jitsiApi.executeCommand('toggleAudio');
      }
    } else {
      this.isAudioMuted = force;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isAudioMuted: this.isAudioMuted });
      this.emit('audioMuteChanged', this.isAudioMuted);
    }
  }

  toggleVideo(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleVideo');
    } else {
      this.isVideoMuted = !this.isVideoMuted;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isVideoMuted: this.isVideoMuted });
      this.emit('videoMuteChanged', this.isVideoMuted);
    }
  }

  muteVideo(force: boolean = true): void {
    if (this.jitsiApi) {
      if (force && !this.isVideoMuted) {
        this.jitsiApi.executeCommand('toggleVideo');
      }
    } else {
      this.isVideoMuted = force;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isVideoMuted: this.isVideoMuted });
      this.emit('videoMuteChanged', this.isVideoMuted);
    }
  }

  toggleScreenShare(): void {
    if (this.jitsiApi) {
      this.jitsiApi.executeCommand('toggleShareScreen');
    } else {
      this.isScreenSharing = !this.isScreenSharing;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isScreenSharing: this.isScreenSharing });
      this.emit('screenSharingChanged', this.isScreenSharing);
    }
  }

  stopScreenShare(): void {
    if (this.jitsiApi) {
      if (this.isScreenSharing) {
        this.jitsiApi.executeCommand('toggleShareScreen');
      }
    } else {
      this.isScreenSharing = false;
      this.sendSocketMessage(NexusEvents.MEDIA_STATE_CHANGED, { isScreenSharing: false });
      this.emit('screenSharingChanged', false);
    }
  }

  getAudioMuted(): boolean {
    return this.isAudioMuted;
  }

  getVideoMuted(): boolean {
    return this.isVideoMuted;
  }

  getScreenSharing(): boolean {
    return this.isScreenSharing;
  }

  dispose(): void {
    if (this.jitsiApi) {
      try {
        this.jitsiApi.dispose();
      } catch (err) {
        // ignore
      }
      this.jitsiApi = null;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script ${src}`));
      document.head.appendChild(script);
    });
  }
}
