import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from '../src/EventEmitter.js';
import { ChatManager } from '../src/ChatManager.js';
import { BreakoutManager } from '../src/BreakoutManager.js';
import { NexusEvents } from '@nexusrtc/core';

test('NexusRTC Client SDK Unit Tests', async (t) => {
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
});
