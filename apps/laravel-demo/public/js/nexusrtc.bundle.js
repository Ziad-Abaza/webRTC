"use strict";
var NexusRTC = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // packages/core/dist/types.js
  var require_types = __commonJS({
    "packages/core/dist/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // packages/core/dist/interfaces.js
  var require_interfaces = __commonJS({
    "packages/core/dist/interfaces.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // packages/core/dist/events.js
  var require_events = __commonJS({
    "packages/core/dist/events.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.NexusEvents = void 0;
      var NexusEvents6;
      (function(NexusEvents7) {
        NexusEvents7["JOIN"] = "nexus:join";
        NexusEvents7["JOINED"] = "nexus:joined";
        NexusEvents7["LEAVE"] = "nexus:leave";
        NexusEvents7["LEFT"] = "nexus:left";
        NexusEvents7["ERROR"] = "nexus:error";
        NexusEvents7["PARTICIPANT_JOINED"] = "nexus:participant_joined";
        NexusEvents7["PARTICIPANT_LEFT"] = "nexus:participant_left";
        NexusEvents7["PARTICIPANT_UPDATED"] = "nexus:participant_updated";
        NexusEvents7["MEDIA_STATE_CHANGED"] = "nexus:media_state_changed";
        NexusEvents7["SCREEN_SHARE_STARTED"] = "nexus:screen_share_started";
        NexusEvents7["SCREEN_SHARE_STOPPED"] = "nexus:screen_share_stopped";
        NexusEvents7["HAND_RAISED"] = "nexus:hand_raised";
        NexusEvents7["HAND_LOWERED"] = "nexus:hand_lowered";
        NexusEvents7["MODERATE_PARTICIPANT"] = "nexus:moderate_participant";
        NexusEvents7["PARTICIPANT_MODERATED"] = "nexus:participant_moderated";
        NexusEvents7["ROOM_MUTED_ALL"] = "nexus:room_muted_all";
        NexusEvents7["CHAT_SEND"] = "nexus:chat_send";
        NexusEvents7["CHAT_RECEIVED"] = "nexus:chat_received";
        NexusEvents7["RECORDING_START"] = "nexus:recording_start";
        NexusEvents7["RECORDING_STOP"] = "nexus:recording_stop";
        NexusEvents7["RECORDING_STATE_CHANGED"] = "nexus:recording_state_changed";
        NexusEvents7["BREAKOUT_CREATE"] = "nexus:breakout_create";
        NexusEvents7["BREAKOUT_CREATED"] = "nexus:breakout_created";
        NexusEvents7["BREAKOUT_JOIN"] = "nexus:breakout_join";
        NexusEvents7["BREAKOUT_LEAVE"] = "nexus:breakout_leave";
        NexusEvents7["BREAKOUT_UPDATED"] = "nexus:breakout_updated";
        NexusEvents7["BREAKOUT_BROADCAST"] = "nexus:breakout_broadcast";
        NexusEvents7["BREAKOUT_CLOSED"] = "nexus:breakout_closed";
        NexusEvents7["BROADCAST_START"] = "nexus:broadcast_start";
        NexusEvents7["BROADCAST_STOP"] = "nexus:broadcast_stop";
        NexusEvents7["BROADCAST_STATE_CHANGED"] = "nexus:broadcast_state_changed";
      })(NexusEvents6 || (exports.NexusEvents = NexusEvents6 = {}));
    }
  });

  // packages/core/dist/index.js
  var require_dist = __commonJS({
    "packages/core/dist/index.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __exportStar = exports && exports.__exportStar || function(m, exports2) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      __exportStar(require_types(), exports);
      __exportStar(require_interfaces(), exports);
      __exportStar(require_events(), exports);
    }
  });

  // packages/client/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    BreakoutManager: () => BreakoutManager,
    ChatManager: () => ChatManager,
    EventEmitter: () => EventEmitter,
    MediaManager: () => MediaManager,
    NexusClient: () => NexusClient,
    NexusEvents: () => import_core5.NexusEvents
  });

  // packages/client/src/EventEmitter.ts
  var EventEmitter = class {
    events = /* @__PURE__ */ new Map();
    on(event, handler) {
      if (!this.events.has(event)) {
        this.events.set(event, /* @__PURE__ */ new Set());
      }
      this.events.get(event).add(handler);
      return () => this.off(event, handler);
    }
    once(event, handler) {
      const wrapper = (data) => {
        this.off(event, wrapper);
        handler(data);
      };
      this.on(event, wrapper);
    }
    off(event, handler) {
      const handlers = this.events.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.events.delete(event);
        }
      }
    }
    emit(event, data) {
      const handlers = this.events.get(event);
      if (handlers) {
        for (const handler of Array.from(handlers)) {
          try {
            handler(data);
          } catch (err) {
            console.error(`[EventEmitter Error] event: ${event}`, err);
          }
        }
      }
    }
    removeAllListeners(event) {
      if (event) {
        this.events.delete(event);
      } else {
        this.events.clear();
      }
    }
  };

  // packages/client/src/MediaManager.ts
  var import_core = __toESM(require_dist());
  var MediaManager = class extends EventEmitter {
    constructor(sendSocketMessage) {
      super();
      this.sendSocketMessage = sendSocketMessage;
    }
    sendSocketMessage;
    jitsiApi = null;
    isAudioMuted = true;
    isVideoMuted = true;
    isScreenSharing = false;
    async attachJitsi(container, config) {
      if (typeof window === "undefined") return;
      if (!window.JitsiMeetExternalAPI) {
        await this.loadScript(`https://${config.domain}/external_api.js`);
      }
      if (!window.JitsiMeetExternalAPI) {
        console.warn("JitsiMeetExternalAPI could not be loaded. Running in headless media mode.");
        return;
      }
      const options = {
        roomName: config.room,
        parentNode: container,
        jwt: config.token,
        width: config.width || "100%",
        height: config.height || "100%",
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          ...config.configOverwrite
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_BUTTONS: [
            "microphone",
            "camera",
            "closedcaptions",
            "desktop",
            "fullscreen",
            "fodeviceselection",
            "hangup",
            "profile",
            "chat",
            "recording",
            "livestreaming",
            "etherpad",
            "sharedvideo",
            "settings",
            "raisehand",
            "videoquality",
            "filmstrip",
            "invite",
            "feedback",
            "stats",
            "shortcuts",
            "tileview",
            "videobackgroundblur",
            "download",
            "help",
            "mute-everyone",
            "security"
          ],
          ...config.interfaceConfigOverwrite
        }
      };
      this.jitsiApi = new window.JitsiMeetExternalAPI(config.domain, options);
      this.jitsiApi.addEventListener("audioMuteStatusChanged", ({ muted }) => {
        this.isAudioMuted = muted;
        this.sendSocketMessage(import_core.NexusEvents.MEDIA_STATE_CHANGED, { isAudioMuted: muted });
        this.emit("audioMuteChanged", muted);
      });
      this.jitsiApi.addEventListener("videoMuteStatusChanged", ({ muted }) => {
        this.isVideoMuted = muted;
        this.sendSocketMessage(import_core.NexusEvents.MEDIA_STATE_CHANGED, { isVideoMuted: muted });
        this.emit("videoMuteChanged", muted);
      });
      this.jitsiApi.addEventListener("screenSharingStatusChanged", ({ on }) => {
        this.isScreenSharing = on;
        this.sendSocketMessage(import_core.NexusEvents.MEDIA_STATE_CHANGED, { isScreenSharing: on });
        this.emit("screenSharingChanged", on);
      });
      this.emit("ready");
    }
    toggleAudio() {
      if (this.jitsiApi) {
        this.jitsiApi.executeCommand("toggleAudio");
      } else {
        this.isAudioMuted = !this.isAudioMuted;
        this.sendSocketMessage(import_core.NexusEvents.MEDIA_STATE_CHANGED, { isAudioMuted: this.isAudioMuted });
        this.emit("audioMuteChanged", this.isAudioMuted);
      }
    }
    toggleVideo() {
      if (this.jitsiApi) {
        this.jitsiApi.executeCommand("toggleVideo");
      } else {
        this.isVideoMuted = !this.isVideoMuted;
        this.sendSocketMessage(import_core.NexusEvents.MEDIA_STATE_CHANGED, { isVideoMuted: this.isVideoMuted });
        this.emit("videoMuteChanged", this.isVideoMuted);
      }
    }
    toggleScreenShare() {
      if (this.jitsiApi) {
        this.jitsiApi.executeCommand("toggleShareScreen");
      } else {
        this.isScreenSharing = !this.isScreenSharing;
        this.sendSocketMessage(import_core.NexusEvents.MEDIA_STATE_CHANGED, { isScreenSharing: this.isScreenSharing });
        this.emit("screenSharingChanged", this.isScreenSharing);
      }
    }
    dispose() {
      if (this.jitsiApi) {
        try {
          this.jitsiApi.dispose();
        } catch (err) {
        }
        this.jitsiApi = null;
      }
    }
    loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script ${src}`));
        document.head.appendChild(script);
      });
    }
  };

  // packages/client/src/ChatManager.ts
  var import_core2 = __toESM(require_dist());
  var ChatManager = class extends EventEmitter {
    constructor(sendSocketMessage) {
      super();
      this.sendSocketMessage = sendSocketMessage;
    }
    sendSocketMessage;
    messages = [];
    handleIncomingMessage(message) {
      this.messages.push(message);
      this.emit("message", message);
    }
    send(content, recipientId) {
      if (!content.trim()) return;
      this.sendSocketMessage(import_core2.NexusEvents.CHAT_SEND, {
        content: content.trim(),
        recipientId
      });
    }
    sendMessage(content, recipientId) {
      this.send(content, recipientId);
    }
    getMessages() {
      return [...this.messages];
    }
    clear() {
      this.messages = [];
    }
  };

  // packages/client/src/BreakoutManager.ts
  var import_core3 = __toESM(require_dist());
  var BreakoutManager = class extends EventEmitter {
    constructor(sendSocketMessage) {
      super();
      this.sendSocketMessage = sendSocketMessage;
    }
    sendSocketMessage;
    breakoutRooms = /* @__PURE__ */ new Map();
    currentBreakoutRoomId = null;
    setInitialBreakouts(rooms) {
      this.breakoutRooms.clear();
      for (const r of rooms) {
        this.breakoutRooms.set(r.id, r);
      }
      this.emit("updated", this.getBreakoutRooms());
    }
    handleBreakoutCreated(breakout) {
      this.breakoutRooms.set(breakout.id, breakout);
      this.emit("created", breakout);
      this.emit("updated", this.getBreakoutRooms());
    }
    handleBreakoutUpdated(breakout) {
      this.breakoutRooms.set(breakout.id, breakout);
      this.emit("updated", this.getBreakoutRooms());
    }
    createBreakout(name, durationMinutes) {
      this.sendSocketMessage(import_core3.NexusEvents.BREAKOUT_CREATE, { name, durationMinutes });
    }
    joinBreakout(breakoutRoomId) {
      this.currentBreakoutRoomId = breakoutRoomId;
      this.sendSocketMessage(import_core3.NexusEvents.BREAKOUT_JOIN, { breakoutRoomId });
      this.emit("joined", breakoutRoomId);
    }
    leaveBreakout() {
      this.currentBreakoutRoomId = null;
      this.sendSocketMessage(import_core3.NexusEvents.BREAKOUT_LEAVE, {});
      this.emit("left");
    }
    broadcastToAll(message) {
      this.sendSocketMessage(import_core3.NexusEvents.BREAKOUT_BROADCAST, { message });
    }
    getBreakoutRooms() {
      return Array.from(this.breakoutRooms.values());
    }
    getCurrentBreakoutRoomId() {
      return this.currentBreakoutRoomId;
    }
  };

  // packages/client/src/NexusClient.ts
  var import_core4 = __toESM(require_dist());
  var NexusClient = class extends EventEmitter {
    ws = null;
    wsUrl;
    token;
    joinedData = null;
    participantsMap = /* @__PURE__ */ new Map();
    media;
    chat;
    breakout;
    constructor(options) {
      super();
      this.wsUrl = options.wsUrl;
      this.token = options.token;
      const sendSocket = (event, payload) => this.send(event, payload);
      this.media = new MediaManager(sendSocket);
      this.chat = new ChatManager(sendSocket);
      this.breakout = new BreakoutManager(sendSocket);
      if (options.autoConnect !== false) {
        this.connect();
      }
    }
    connect() {
      return new Promise((resolve, reject) => {
        try {
          const WebSocketClass = typeof window !== "undefined" ? window.WebSocket : globalThis.WebSocket;
          if (!WebSocketClass) {
            throw new Error("No WebSocket implementation found in runtime environment");
          }
          this.ws = new WebSocketClass(this.wsUrl);
          this.ws.onopen = () => {
            this.emit("connected");
            this.send(import_core4.NexusEvents.JOIN, { token: this.token });
          };
          this.ws.onmessage = (event) => {
            try {
              const data = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
              this.handleSocketEvent(data.event, data.payload, resolve);
            } catch (err) {
              console.error("[NexusClient] Failed to parse message", err);
            }
          };
          this.ws.onerror = (err) => {
            this.emit("error", err);
          };
          this.ws.onclose = () => {
            this.emit("disconnected");
          };
        } catch (err) {
          reject(err);
        }
      });
    }
    handleSocketEvent(event, payload, joinResolve) {
      switch (event) {
        case import_core4.NexusEvents.JOINED: {
          this.joinedData = payload;
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
          this.emit("joined", this.joinedData);
          break;
        }
        case import_core4.NexusEvents.PARTICIPANT_JOINED: {
          const participant = payload;
          this.participantsMap.set(participant.id, participant);
          this.emit("participantJoined", participant);
          this.emit("participantsChanged", this.getParticipants());
          break;
        }
        case import_core4.NexusEvents.PARTICIPANT_LEFT: {
          const { participantId } = payload;
          const p = this.participantsMap.get(participantId);
          this.participantsMap.delete(participantId);
          this.emit("participantLeft", { participantId, participant: p });
          this.emit("participantsChanged", this.getParticipants());
          break;
        }
        case import_core4.NexusEvents.MEDIA_STATE_CHANGED: {
          const { participantId, isAudioMuted, isVideoMuted, isScreenSharing } = payload;
          const p = this.participantsMap.get(participantId);
          if (p) {
            if (typeof isAudioMuted === "boolean") p.isAudioMuted = isAudioMuted;
            if (typeof isVideoMuted === "boolean") p.isVideoMuted = isVideoMuted;
            if (typeof isScreenSharing === "boolean") p.isScreenSharing = isScreenSharing;
            this.emit("participantMediaChanged", p);
          }
          break;
        }
        case import_core4.NexusEvents.HAND_RAISED: {
          const { participantId } = payload;
          const p = this.participantsMap.get(participantId);
          if (p) {
            p.isHandRaised = true;
            this.emit("handRaised", p);
          }
          break;
        }
        case import_core4.NexusEvents.HAND_LOWERED: {
          const { participantId } = payload;
          const p = this.participantsMap.get(participantId);
          if (p) {
            p.isHandRaised = false;
            this.emit("handLowered", p);
          }
          break;
        }
        case import_core4.NexusEvents.CHAT_RECEIVED: {
          const msg = payload;
          this.chat.handleIncomingMessage(msg);
          this.emit("chatMessage", msg);
          break;
        }
        case import_core4.NexusEvents.BREAKOUT_CREATED: {
          this.breakout.handleBreakoutCreated(payload);
          break;
        }
        case import_core4.NexusEvents.BREAKOUT_UPDATED: {
          this.breakout.handleBreakoutUpdated(payload);
          break;
        }
        case import_core4.NexusEvents.BREAKOUT_BROADCAST: {
          this.emit("breakoutBroadcast", payload);
          break;
        }
        case import_core4.NexusEvents.RECORDING_STATE_CHANGED: {
          const recording = payload;
          this.emit("recordingStateChanged", recording);
          break;
        }
        case import_core4.NexusEvents.BROADCAST_STATE_CHANGED: {
          const broadcast = payload;
          this.emit("broadcastStateChanged", broadcast);
          break;
        }
        case import_core4.NexusEvents.PARTICIPANT_MODERATED: {
          this.emit("moderated", payload);
          break;
        }
        case import_core4.NexusEvents.ERROR: {
          this.emit("error", payload);
          break;
        }
        default:
          break;
      }
    }
    send(event, payload) {
      if (this.ws && this.ws.readyState === (this.ws.OPEN ?? 1)) {
        this.ws.send(JSON.stringify({ event, payload }));
      }
    }
    // Raise Hand
    toggleRaiseHand() {
      const self = this.getSelf();
      const newState = self ? !self.isHandRaised : true;
      if (self) self.isHandRaised = newState;
      this.send(import_core4.NexusEvents.HAND_RAISED, { isHandRaised: newState });
    }
    // Recording
    startRecording() {
      this.send(import_core4.NexusEvents.RECORDING_START, {});
    }
    stopRecording() {
      this.send(import_core4.NexusEvents.RECORDING_STOP, {});
    }
    // Live Broadcast
    startBroadcast(streamUrl, streamKey) {
      this.send(import_core4.NexusEvents.BROADCAST_START, { streamUrl, streamKey });
    }
    stopBroadcast() {
      this.send(import_core4.NexusEvents.BROADCAST_STOP, {});
    }
    // Moderation
    moderateParticipant(targetParticipantId, action) {
      this.send(import_core4.NexusEvents.MODERATE_PARTICIPANT, { targetParticipantId, action });
    }
    // State accessors
    getSelf() {
      return this.joinedData?.self || null;
    }
    getParticipants() {
      return Array.from(this.participantsMap.values());
    }
    getRoomDetails() {
      return this.joinedData?.room || null;
    }
    getMediaDetails() {
      return this.joinedData?.media || null;
    }
    disconnect() {
      this.media.dispose();
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.removeAllListeners();
    }
  };

  // packages/client/src/index.ts
  var import_core5 = __toESM(require_dist());
  return __toCommonJS(index_exports);
})();
