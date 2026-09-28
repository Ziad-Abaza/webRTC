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

  // ../core/dist/types.js
  var require_types = __commonJS({
    "../core/dist/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // ../core/dist/interfaces.js
  var require_interfaces = __commonJS({
    "../core/dist/interfaces.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // ../core/dist/events.js
  var require_events = __commonJS({
    "../core/dist/events.js"(exports) {
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
        NexusEvents7["UPDATE_PERMISSIONS"] = "nexus:update_permissions";
        NexusEvents7["PERMISSIONS_UPDATED"] = "nexus:permissions_updated";
        NexusEvents7["LOCKS_CHANGED"] = "nexus:locks_changed";
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

  // ../core/dist/permissions.js
  var require_permissions = __commonJS({
    "../core/dist/permissions.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ROLE_HIERARCHY = exports.DEFAULT_ROLE_PERMISSIONS = exports.RoomPermission = void 0;
      exports.getRoleRank = getRoleRank;
      exports.canModerateParticipant = canModerateParticipant;
      exports.resolveEffectivePermissions = resolveEffectivePermissions;
      var RoomPermission2;
      (function(RoomPermission3) {
        RoomPermission3["SEND_AUDIO"] = "media:send_audio";
        RoomPermission3["SEND_VIDEO"] = "media:send_video";
        RoomPermission3["SHARE_SCREEN"] = "media:share_screen";
        RoomPermission3["SEND_CHAT"] = "chat:send";
        RoomPermission3["SEND_PRIVATE_CHAT"] = "chat:send_private";
        RoomPermission3["RAISE_HAND"] = "interaction:raise_hand";
        RoomPermission3["CREATE_BREAKOUT"] = "breakout:create";
        RoomPermission3["JOIN_BREAKOUT"] = "breakout:join";
        RoomPermission3["BROADCAST_BREAKOUT"] = "breakout:broadcast";
        RoomPermission3["START_RECORDING"] = "session:start_recording";
        RoomPermission3["STOP_RECORDING"] = "session:stop_recording";
        RoomPermission3["START_BROADCAST"] = "session:start_broadcast";
        RoomPermission3["STOP_BROADCAST"] = "session:stop_broadcast";
        RoomPermission3["MUTE_OTHERS"] = "moderation:mute_others";
        RoomPermission3["KICK_PARTICIPANTS"] = "moderation:kick_participants";
        RoomPermission3["UPDATE_ROOM_PERMISSIONS"] = "session:update_permissions";
        RoomPermission3["MANAGE_PARTICIPANTS"] = "moderation:manage_participants";
      })(RoomPermission2 || (exports.RoomPermission = RoomPermission2 = {}));
      exports.DEFAULT_ROLE_PERMISSIONS = {
        host: [
          RoomPermission2.SEND_AUDIO,
          RoomPermission2.SEND_VIDEO,
          RoomPermission2.SHARE_SCREEN,
          RoomPermission2.SEND_CHAT,
          RoomPermission2.SEND_PRIVATE_CHAT,
          RoomPermission2.RAISE_HAND,
          RoomPermission2.CREATE_BREAKOUT,
          RoomPermission2.JOIN_BREAKOUT,
          RoomPermission2.BROADCAST_BREAKOUT,
          RoomPermission2.START_RECORDING,
          RoomPermission2.STOP_RECORDING,
          RoomPermission2.START_BROADCAST,
          RoomPermission2.STOP_BROADCAST,
          RoomPermission2.MUTE_OTHERS,
          RoomPermission2.KICK_PARTICIPANTS,
          RoomPermission2.UPDATE_ROOM_PERMISSIONS,
          RoomPermission2.MANAGE_PARTICIPANTS
        ],
        moderator: [
          RoomPermission2.SEND_AUDIO,
          RoomPermission2.SEND_VIDEO,
          RoomPermission2.SHARE_SCREEN,
          RoomPermission2.SEND_CHAT,
          RoomPermission2.SEND_PRIVATE_CHAT,
          RoomPermission2.RAISE_HAND,
          RoomPermission2.CREATE_BREAKOUT,
          RoomPermission2.JOIN_BREAKOUT,
          RoomPermission2.BROADCAST_BREAKOUT,
          RoomPermission2.START_RECORDING,
          RoomPermission2.STOP_RECORDING,
          RoomPermission2.MUTE_OTHERS,
          RoomPermission2.KICK_PARTICIPANTS,
          RoomPermission2.MANAGE_PARTICIPANTS
        ],
        participant: [
          RoomPermission2.SEND_AUDIO,
          RoomPermission2.SEND_VIDEO,
          RoomPermission2.SHARE_SCREEN,
          RoomPermission2.SEND_CHAT,
          RoomPermission2.SEND_PRIVATE_CHAT,
          RoomPermission2.RAISE_HAND,
          RoomPermission2.JOIN_BREAKOUT
        ],
        viewer: [
          RoomPermission2.RAISE_HAND
        ]
      };
      exports.ROLE_HIERARCHY = {
        host: 100,
        moderator: 50,
        participant: 10,
        viewer: 1
      };
      function getRoleRank(role) {
        return exports.ROLE_HIERARCHY[role] ?? 10;
      }
      function canModerateParticipant(callerRole, callerId, targetRole, targetId, roomHostId) {
        if (callerId === targetId) {
          return { allowed: false, reason: "Cannot moderate self" };
        }
        if (targetRole === "host" || roomHostId && targetId === roomHostId) {
          return { allowed: false, reason: "Cannot moderate or kick the room host" };
        }
        if (targetRole === "moderator" && callerRole !== "host" && (!roomHostId || callerId !== roomHostId)) {
          return { allowed: false, reason: "Moderators cannot be moderated by peer moderators or participants" };
        }
        const callerRank = getRoleRank(callerRole);
        const targetRank = getRoleRank(targetRole);
        if (callerRank <= targetRank) {
          return { allowed: false, reason: "Unauthorized to moderate participant with equal or higher role hierarchy" };
        }
        return { allowed: true };
      }
      function resolveEffectivePermissions(role, participantId, config, features) {
        let rolePerms;
        if (role === "host") {
          const baseHost = exports.DEFAULT_ROLE_PERMISSIONS.host;
          const customHost = config?.roles?.["host"] || [];
          const overrides = participantId && config?.participantOverrides?.[participantId] || [];
          rolePerms = Array.from(/* @__PURE__ */ new Set([...baseHost, ...customHost, ...overrides]));
        } else if (participantId && config?.participantOverrides?.[participantId]) {
          rolePerms = config.participantOverrides[participantId];
        } else {
          rolePerms = config?.roles?.[role] || exports.DEFAULT_ROLE_PERMISSIONS[role] || [];
        }
        const effective = new Set(rolePerms);
        if (features) {
          if (features.recordingEnabled === false) {
            effective.delete(RoomPermission2.START_RECORDING);
            effective.delete(RoomPermission2.STOP_RECORDING);
          }
          if (features.breakoutRoomsEnabled === false) {
            effective.delete(RoomPermission2.CREATE_BREAKOUT);
            effective.delete(RoomPermission2.JOIN_BREAKOUT);
            effective.delete(RoomPermission2.BROADCAST_BREAKOUT);
          }
          if (features.chatEnabled === false) {
            effective.delete(RoomPermission2.SEND_CHAT);
            effective.delete(RoomPermission2.SEND_PRIVATE_CHAT);
          }
          if (features.screenShareEnabled === false) {
            effective.delete(RoomPermission2.SHARE_SCREEN);
          }
          if (features.raiseHandEnabled === false) {
            effective.delete(RoomPermission2.RAISE_HAND);
          }
          if (features.liveStreamingEnabled === false) {
            effective.delete(RoomPermission2.START_BROADCAST);
            effective.delete(RoomPermission2.STOP_BROADCAST);
          }
        }
        if (role === "host") {
          return effective;
        }
        if (config?.locks) {
          if (config.locks.lockMicrophones)
            effective.delete(RoomPermission2.SEND_AUDIO);
          if (config.locks.lockCameras)
            effective.delete(RoomPermission2.SEND_VIDEO);
          if (config.locks.lockScreenshare)
            effective.delete(RoomPermission2.SHARE_SCREEN);
          if (config.locks.lockChat)
            effective.delete(RoomPermission2.SEND_CHAT);
          if (config.locks.lockPrivateChat)
            effective.delete(RoomPermission2.SEND_PRIVATE_CHAT);
        }
        return effective;
      }
    }
  });

  // ../core/dist/index.js
  var require_dist = __commonJS({
    "../core/dist/index.js"(exports) {
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
      __exportStar(require_permissions(), exports);
    }
  });

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    BreakoutManager: () => BreakoutManager,
    ChatManager: () => ChatManager,
    EventEmitter: () => EventEmitter,
    MediaManager: () => MediaManager,
    NexusClient: () => NexusClient,
    NexusEvents: () => import_core5.NexusEvents,
    RoomPermission: () => import_core5.RoomPermission
  });

  // src/EventEmitter.ts
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

  // src/MediaManager.ts
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
      const isHost = config.role === "host" || config.role === "moderator";
      const perms = config.permissions || [];
      const hasPerm = (p) => perms.includes(p);
      const toolbarButtons = [
        "fullscreen",
        "fodeviceselection",
        "hangup",
        "profile",
        "videoquality",
        "filmstrip",
        "feedback",
        "stats",
        "shortcuts",
        "tileview",
        "videobackgroundblur",
        "download",
        "help"
      ];
      if (isHost || hasPerm("media:send_audio")) toolbarButtons.push("microphone");
      if (isHost || hasPerm("media:send_video")) toolbarButtons.push("camera");
      if (isHost || hasPerm("media:share_screen")) toolbarButtons.push("desktop");
      if (isHost || hasPerm("chat:send")) toolbarButtons.push("chat");
      if (isHost || hasPerm("interaction:raise_hand")) toolbarButtons.push("raisehand");
      if (isHost || hasPerm("session:start_recording")) toolbarButtons.push("recording");
      if (isHost || hasPerm("session:start_broadcast")) toolbarButtons.push("livestreaming");
      if (isHost || hasPerm("moderation:mute_others")) toolbarButtons.push("mute-everyone");
      if (isHost || hasPerm("session:update_permissions")) toolbarButtons.push("security");
      const options = {
        roomName: config.room,
        parentNode: container,
        ...config.token ? { jwt: config.token } : {},
        width: config.width || "100%",
        height: config.height || "100%",
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          remoteVideoMenu: {
            disableKick: !isHost,
            disableGrantModerator: !isHost,
            disablePrivateChat: !hasPerm("chat:send_private")
          },
          disableRemoteMute: !isHost && !hasPerm("moderation:mute_others"),
          participantsPane: {
            hideMoreActionsButton: !isHost,
            hideMuteAllButton: !isHost && !hasPerm("moderation:mute_others")
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
    muteAudio(force = true) {
      if (this.jitsiApi) {
        if (force && !this.isAudioMuted) {
          this.jitsiApi.executeCommand("toggleAudio");
        }
      } else {
        this.isAudioMuted = force;
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
    muteVideo(force = true) {
      if (this.jitsiApi) {
        if (force && !this.isVideoMuted) {
          this.jitsiApi.executeCommand("toggleVideo");
        }
      } else {
        this.isVideoMuted = force;
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
    stopScreenShare() {
      if (this.jitsiApi) {
        if (this.isScreenSharing) {
          this.jitsiApi.executeCommand("toggleShareScreen");
        }
      } else {
        this.isScreenSharing = false;
        this.sendSocketMessage(import_core.NexusEvents.MEDIA_STATE_CHANGED, { isScreenSharing: false });
        this.emit("screenSharingChanged", false);
      }
    }
    getAudioMuted() {
      return this.isAudioMuted;
    }
    getVideoMuted() {
      return this.isVideoMuted;
    }
    getScreenSharing() {
      return this.isScreenSharing;
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

  // src/ChatManager.ts
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

  // src/BreakoutManager.ts
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
      this.emit("breakoutCreated", breakout);
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
    getBreakouts() {
      return this.getBreakoutRooms();
    }
    getCurrentBreakoutRoomId() {
      return this.currentBreakoutRoomId;
    }
  };

  // src/NexusClient.ts
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
        case import_core4.NexusEvents.PERMISSIONS_UPDATED: {
          const { participantId, permissions } = payload;
          const self = this.getSelf();
          if (self && self.id === participantId) {
            self.permissions = permissions;
          }
          const p = this.participantsMap.get(participantId);
          if (p) {
            p.permissions = permissions;
          }
          this.emit("permissionsUpdated", payload);
          break;
        }
        case import_core4.NexusEvents.LOCKS_CHANGED: {
          this.emit("locksChanged", payload);
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
    // Permissions & Capabilities
    hasPermission(permission) {
      const self = this.getSelf();
      if (!self || !self.permissions) return false;
      return self.permissions.includes(permission);
    }
    getEffectivePermissions() {
      const self = this.getSelf();
      return self?.permissions || [];
    }
    updateRoomPermissions(permissions, locks) {
      this.send(import_core4.NexusEvents.UPDATE_PERMISSIONS, { permissions, locks });
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

  // src/index.ts
  var import_core5 = __toESM(require_dist());
  return __toCommonJS(index_exports);
})();
