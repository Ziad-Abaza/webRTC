import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from '../src/EventEmitter.js';
import { ChatManager } from '../src/ChatManager.js';
import { BreakoutManager } from '../src/BreakoutManager.js';
import { MediaManager } from '../src/MediaManager.js';
import { NexusClient, WebRTCClient } from '../src/NexusClient.js';
import { NexusEvents, WebRTCEvents } from '@webrtc/core';

test('WebRTC Client SDK Unit Tests', async (t) => {
  await t.test('EventEmitter emits and registers listeners', () => {
    const emitter = new EventEmitter();
    let called = false;
    let payload = '';

    emitter.on('test-event', (data) => {
      called = true;
      payload = data;
    });

    emitter.emit('test-event', 'hello nexus');
    assert.equal(called, true);
    assert.equal(payload, 'hello nexus');
  });

  await t.test('ChatManager sends and tracks messages', () => {
    const dispatched: { event: any; payload: any }[] = [];
    const chat = new ChatManager((event, payload) => {
      dispatched.push({ event, payload });
    });

    chat.sendMessage('Hello everyone!');
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].event, NexusEvents.CHAT_SEND);
    assert.equal(dispatched[0].payload.content, 'Hello everyone!');

    // Receive message
    chat.handleIncomingMessage({
      id: 'msg-1',
      roomId: 'room-1',
      senderId: 'user-2',
      senderName: 'Bob',
      senderRole: 'participant',
      content: 'Hey Alice',
      timestamp: Date.now(),
      isPrivate: false
    });

    const history = chat.getMessages();
    assert.equal(history.length, 1);
    assert.equal(history[0].senderName, 'Bob');
  });

  await t.test('BreakoutManager handles creation and joining', () => {
    const dispatched: { event: any; payload: any }[] = [];
    const breakout = new BreakoutManager((event, payload) => {
      dispatched.push({ event, payload });
    });

    breakout.createBreakout('Marketing Sync', 20);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].event, NexusEvents.BREAKOUT_CREATE);
    assert.equal(dispatched[0].payload.name, 'Marketing Sync');

    breakout.joinBreakout('room-sub-1');
    assert.equal(dispatched.length, 2);
    assert.equal(dispatched[1].event, NexusEvents.BREAKOUT_JOIN);
    assert.equal(dispatched[1].payload.breakoutRoomId, 'room-sub-1');
  });

  await t.test('MediaManager mute commands and audio/video state controls', () => {
    const dispatched: { event: any; payload: any }[] = [];
    const media = new MediaManager((event: any, payload: any) => {
      dispatched.push({ event, payload });
    });

    media.muteAudio(true);
    assert.equal(media.getAudioMuted(), true);
    assert.equal(dispatched[dispatched.length - 1].payload.isAudioMuted, true);

    media.muteVideo(false);
    assert.equal(media.getVideoMuted(), false);
    assert.equal(dispatched[dispatched.length - 1].payload.isVideoMuted, false);
  });

  await t.test('BreakoutManager getBreakouts alias and breakoutCreated event', () => {
    const breakout = new BreakoutManager(() => {});
    let eventReceived = false;
    breakout.on('breakoutCreated', (room) => {
      eventReceived = true;
      assert.equal(room.name, 'Sub Room 1');
    });

    breakout.handleBreakoutCreated({
      id: 'sub-1',
      parentRoomId: 'room-1',
      name: 'Sub Room 1',
      createdAt: Date.now(),
      participantIds: [],
      isActive: true
    });

    assert.equal(eventReceived, true);
    assert.equal(breakout.getBreakouts().length, 1);
    assert.equal(breakout.getBreakouts()[0].name, 'Sub Room 1');
  });

  await t.test('NexusClient hasPermission and getEffectivePermissions', () => {
    const client = new NexusClient({
      wsUrl: 'ws://127.0.0.1:4999/ws',
      token: 'test-token',
      autoConnect: false
    });

    // Before joining
    assert.equal(client.hasPermission('media:send_audio'), false);
    assert.deepEqual(client.getEffectivePermissions(), []);

    // Simulate join with permissions
    (client as any).handleSocketEvent(NexusEvents.JOINED, {
      room: { id: 'r1', slug: 'r1', title: 'Room', hostId: 'h1', createdAt: Date.now(), features: {}, permissions: {} },
      self: {
        id: 'p1',
        name: 'Alice',
        role: 'participant',
        joinedAt: Date.now(),
        isAudioMuted: false,
        isVideoMuted: false,
        isScreenSharing: false,
        isHandRaised: false,
        permissions: ['media:send_audio', 'chat:send']
      },
      participants: [],
      activeBreakoutRooms: [],
      activeBroadcast: null,
      activeRecording: null,
      media: { provider: 'jitsi', domain: 'meet.jit.si', room: 'r1', appId: '' }
    });

    assert.equal(client.hasPermission('media:send_audio'), true);
    assert.equal(client.hasPermission('chat:send'), true);
    assert.equal(client.hasPermission('moderation:mute_others'), false);
    assert.deepEqual(client.getEffectivePermissions(), ['media:send_audio', 'chat:send']);
  });
});
