import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';
import WebSocket from 'ws';
import { NexusEvents } from '@nexusrtc/core';

test('NexusRTC Server E2E Flow', async (t) => {
  const instance = createServer();
  const port = 4999;
  instance.config.port = port;

  await instance.start();

  t.after(async () => {
    await instance.stop();
  });

  let roomId = '';
  let roomSlug = '';
  let hostToken = '';
  let participantToken = '';

  await t.test('REST: Create Room', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        title: 'Weekly Standup',
        hostId: 'user-alice',
        features: {
          recordingEnabled: true,
          chatEnabled: true,
          breakoutRoomsEnabled: true
        }
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    assert.ok(data.slug);
    assert.equal(data.title, 'Weekly Standup');
    roomId = data.id;
    roomSlug = data.slug;
  });

  await t.test('REST: Generate Join Tokens for Host and Participant', async () => {
    // Generate Host Token
    const hostRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'user-alice',
        name: 'Alice Host',
        role: 'host'
      })
    });
    assert.equal(hostRes.status, 200);
    const hostData = await hostRes.json();
    assert.ok(hostData.token);
    assert.equal(hostData.participant.role, 'host');
    hostToken = hostData.token;

    // Generate Participant Token
    const partRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'user-bob',
        name: 'Bob Participant',
        role: 'participant'
      })
    });
    assert.equal(partRes.status, 200);
    const partData = await partRes.json();
    assert.ok(partData.token);
    assert.equal(partData.participant.role, 'participant');
    participantToken = partData.token;
  });

  await t.test('WebSocket: Alice and Bob Join, Exchange Chat, Raise Hand, Breakout', async () => {
    const wsUrl = `ws://localhost:${port}/ws`;
    const aliceWs = new WebSocket(wsUrl);
    const bobWs = new WebSocket(wsUrl);

    await Promise.all([
      new Promise((resolve) => aliceWs.on('open', resolve)),
      new Promise((resolve) => bobWs.on('open', resolve))
    ]);

    // Alice Joins
    const aliceJoinedPromise = new Promise<any>((resolve) => {
      aliceWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.JOINED) {
          resolve(parsed.payload);
        }
      });
    });

    aliceWs.send(JSON.stringify({
      event: NexusEvents.JOIN,
      payload: { token: hostToken }
    }));

    const aliceJoinedData = await aliceJoinedPromise;
    assert.equal(aliceJoinedData.self.name, 'Alice Host');

    // Bob Joins
    const bobJoinedPromise = new Promise<any>((resolve) => {
      bobWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.JOINED) {
          resolve(parsed.payload);
        }
      });
    });

    bobWs.send(JSON.stringify({
      event: NexusEvents.JOIN,
      payload: { token: participantToken }
    }));

    const bobJoinedData = await bobJoinedPromise;
    assert.equal(bobJoinedData.self.name, 'Bob Participant');

    // Bob raises hand -> Alice receives notification
    const aliceHandPromise = new Promise<any>((resolve) => {
      aliceWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.HAND_RAISED) {
          resolve(parsed.payload);
        }
      });
    });

    bobWs.send(JSON.stringify({
      event: NexusEvents.HAND_RAISED,
      payload: { isHandRaised: true }
    }));

    const handData = await aliceHandPromise;
    assert.equal(handData.participantId, 'user-bob');
    assert.equal(handData.isHandRaised, true);

    // Alice sends chat -> Bob receives chat
    const bobChatPromise = new Promise<any>((resolve) => {
      bobWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.CHAT_RECEIVED) {
          resolve(parsed.payload);
        }
      });
    });

    aliceWs.send(JSON.stringify({
      event: NexusEvents.CHAT_SEND,
      payload: { content: 'Hello Bob! Welcome to NexusRTC' }
    }));

    const chatData = await bobChatPromise;
    assert.equal(chatData.content, 'Hello Bob! Welcome to NexusRTC');
    assert.equal(chatData.senderName, 'Alice Host');

    // Alice creates Breakout Room
    const bobBreakoutPromise = new Promise<any>((resolve) => {
      bobWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.BREAKOUT_CREATED) {
          resolve(parsed.payload);
        }
      });
    });

    aliceWs.send(JSON.stringify({
      event: NexusEvents.BREAKOUT_CREATE,
      payload: { name: 'Breakout 1', durationMinutes: 15 }
    }));

    const breakoutData = await bobBreakoutPromise;
    assert.equal(breakoutData.name, 'Breakout 1');

    // Bob joins Breakout Room
    const aliceBreakoutUpdatePromise = new Promise<any>((resolve) => {
      aliceWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.BREAKOUT_UPDATED) {
          resolve(parsed.payload);
        }
      });
    });

    bobWs.send(JSON.stringify({
      event: NexusEvents.BREAKOUT_JOIN,
      payload: { breakoutRoomId: breakoutData.id }
    }));

    const breakoutUpdate = await aliceBreakoutUpdatePromise;
    assert.ok(breakoutUpdate.participantIds.includes('user-bob'));

    // Alice starts recording -> Bob receives state change
    const bobRecPromise = new Promise<any>((resolve) => {
      bobWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.RECORDING_STATE_CHANGED) {
          resolve(parsed.payload);
        }
      });
    });

    aliceWs.send(JSON.stringify({
      event: NexusEvents.RECORDING_START,
      payload: {}
    }));

    const recData = await bobRecPromise;
    assert.equal(recData.status, 'recording');

    // Alice stops recording -> Bob receives state change
    const bobStopRecPromise = new Promise<any>((resolve) => {
      bobWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.RECORDING_STATE_CHANGED && parsed.payload.status === 'completed') {
          resolve(parsed.payload);
        }
      });
    });

    aliceWs.send(JSON.stringify({
      event: NexusEvents.RECORDING_STOP,
      payload: {}
    }));

    const stopRecData = await bobStopRecPromise;
    assert.equal(stopRecData.status, 'completed');
    assert.ok(stopRecData.downloadUrl);

    // Clean up WebSockets
    aliceWs.close();
    bobWs.close();
  });

  await t.test('Permissions: Viewer Role and Restricted Capabilities Enforcement', async () => {
    // Create room with custom restricted permissions
    const res = await fetch(`http://localhost:${port}/api/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        title: 'Restricted Webinar',
        hostId: 'user-host',
        permissions: {
          roles: {
            viewer: ['interaction:raise_hand'] // Viewers cannot chat or unmute
          }
        }
      })
    });
    const webinar = await res.json();

    // Generate Viewer Token
    const viewerTokenRes = await fetch(`http://localhost:${port}/api/v1/rooms/${webinar.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'user-viewer',
        name: 'Charlie Viewer',
        role: 'viewer'
      })
    });
    const viewerData = await viewerTokenRes.json();
    assert.deepEqual(viewerData.participant.permissions, ['interaction:raise_hand']);

    // Connect Viewer via WebSocket
    const wsUrl = `ws://localhost:${port}/ws`;
    const viewerWs = new WebSocket(wsUrl);
    await new Promise((resolve) => viewerWs.on('open', resolve));

    const joinPromise = new Promise<any>((resolve) => {
      viewerWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.JOINED) resolve(parsed.payload);
      });
    });

    viewerWs.send(JSON.stringify({
      event: NexusEvents.JOIN,
      payload: { token: viewerData.token }
    }));
    await joinPromise;

    // Test 1: Viewer attempts to unmute audio -> Must receive Permission Denied error
    const errAudioPromise = new Promise<any>((resolve) => {
      viewerWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.ERROR) resolve(parsed.payload);
      });
    });

    viewerWs.send(JSON.stringify({
      event: NexusEvents.MEDIA_STATE_CHANGED,
      payload: { isAudioMuted: false }
    }));

    const audioErr = await errAudioPromise;
    assert.match(audioErr.message, /Permission denied: unmuting audio/);

    // Test 2: Viewer attempts to send chat -> Must receive Permission Denied error
    const errChatPromise = new Promise<any>((resolve) => {
      viewerWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.ERROR) resolve(parsed.payload);
      });
    });

    viewerWs.send(JSON.stringify({
      event: NexusEvents.CHAT_SEND,
      payload: { content: 'Hey everyone!' }
    }));

    const chatErr = await errChatPromise;
    assert.match(chatErr.message, /Permission denied: room chat is disabled/);

    // Test 3: Viewer raises hand -> Allowed by permissions
    const handPromise = new Promise<any>((resolve) => {
      viewerWs.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.event === NexusEvents.HAND_RAISED) resolve(parsed.payload);
      });
    });

    viewerWs.send(JSON.stringify({
      event: NexusEvents.HAND_RAISED,
      payload: { isHandRaised: true }
    }));

    const handData = await handPromise;
    assert.equal(handData.isHandRaised, true);
    assert.equal(handData.participantId, 'user-viewer');

    viewerWs.close();
  });
});
