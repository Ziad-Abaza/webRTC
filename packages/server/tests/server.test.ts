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

  await t.test('Security & Authoritative Authorization: Role Forging, Token Tampering and Host Privilege Rejection', async (t2) => {
    // 1. Create a secure meeting with hostId and hostKey
    const createRes = await fetch(`http://localhost:${port}/api/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        title: 'Executive Boardroom',
        hostId: 'real-host-123'
      })
    });
    assert.equal(createRes.status, 201);
    const room = await createRes.json();
    assert.ok(room.hostKey);

    // 2. An invited guest attempts to claim role: 'host' without the secret hostKey
    const guestExploitRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'guest-attacker',
        name: 'Evil Attacker',
        role: 'host' // Maliciously forged role parameter
      })
    });
    assert.equal(guestExploitRes.status, 200);
    const guestExploitData = await guestExploitRes.json();
    // Must be demoted to participant! Host role MUST NOT be granted!
    assert.equal(guestExploitData.participant.role, 'participant');

    // 3. Legitimate host token generation using hostKey
    const legitHostRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'host-session-1',
        name: 'True Host',
        role: 'host',
        hostKey: room.hostKey
      })
    });
    assert.equal(legitHostRes.status, 200);
    const legitHostData = await legitHostRes.json();
    assert.equal(legitHostData.participant.role, 'host');

    // 4. WebSocket connection test for both sessions
    const wsUrl = `ws://localhost:${port}/ws`;
    const hostWs = new WebSocket(wsUrl);
    const guestWs = new WebSocket(wsUrl);

    await Promise.all([
      new Promise((resolve) => hostWs.on('open', resolve)),
      new Promise((resolve) => guestWs.on('open', resolve))
    ]);

    // Host joins
    const hostJoinedPromise = new Promise<any>((resolve) => {
      hostWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.JOINED) resolve(p.payload);
      });
    });
    hostWs.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: legitHostData.token } }));
    await hostJoinedPromise;

    // Guest joins
    const guestJoinedPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.JOINED) resolve(p.payload);
      });
    });
    guestWs.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: guestExploitData.token } }));
    await guestJoinedPromise;

    // Test A: Guest attempts to START RECORDING -> Server MUST reject with unauthorized
    const recErrorPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });

    guestWs.send(JSON.stringify({
      event: NexusEvents.RECORDING_START,
      payload: {}
    }));

    const recError = await recErrorPromise;
    assert.match(recError.message, /Unauthorized to start recording/);

    // Test B: Guest attempts to KICK the host -> Server MUST reject with unauthorized
    const kickErrorPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });

    guestWs.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: 'host-session-1',
        action: 'kick'
      }
    }));

    const kickError = await kickErrorPromise;
    assert.match(kickError.message, /Unauthorized to kick participants/);

    // Test C: Guest attempts to MUTE the host -> Server MUST reject with unauthorized
    const muteErrorPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });

    guestWs.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: 'host-session-1',
        action: 'mute-audio'
      }
    }));

    const muteError = await muteErrorPromise;
    assert.match(muteError.message, /Unauthorized to mute other participants/);

    // Test D: Guest attempts to CREATE BREAKOUT ROOM -> Server MUST reject with unauthorized
    const breakoutErrorPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });

    guestWs.send(JSON.stringify({
      event: NexusEvents.BREAKOUT_CREATE,
      payload: { name: 'Illegal Breakout', durationMinutes: 10 }
    }));

    const breakoutError = await breakoutErrorPromise;
    assert.match(breakoutError.message, /Unauthorized to create breakout rooms/);

    // Test E: Guest attempts to UPDATE ROOM PERMISSIONS -> Server MUST reject with unauthorized
    const permErrorPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });

    guestWs.send(JSON.stringify({
      event: NexusEvents.UPDATE_PERMISSIONS,
      payload: {
        locks: { lockMicrophones: true }
      }
    }));

    const permError = await permErrorPromise;
    assert.match(permError.message, /Unauthorized to update room permissions/);

    // Test F: Token Tampering / Invalid Signature -> Server terminates connection immediately
    const tamperedWs = new WebSocket(wsUrl);
    await new Promise((resolve) => tamperedWs.on('open', resolve));

    const tamperedErrorPromise = new Promise<any>((resolve) => {
      tamperedWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });

    // Provide a forged JWT with invalid signature
    tamperedWs.send(JSON.stringify({
      event: NexusEvents.JOIN,
      payload: { token: guestExploitData.token.slice(0, -5) + 'fake0' }
    }));

    const tamperedError = await tamperedErrorPromise;
    assert.match(tamperedError.message, /Invalid or expired token/);

    hostWs.close();
    guestWs.close();
    tamperedWs.close();
  });

  await t.test('Deep Security: Path Traversal, HostKey Sanitization, IDOR Cross-Room Access & WS Rate Limits', async (t3) => {
    // 1. HostKey sanitization on GET /rooms/:idOrSlug
    const roomRes = await fetch(`http://localhost:${port}/api/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        title: 'Secret Vault',
        hostId: 'vault-host'
      })
    });
    const secretRoom = await roomRes.json();
    assert.ok(secretRoom.hostKey);

    // Unauthenticated/guest request to GET /rooms/:idOrSlug MUST NOT leak hostKey
    const publicRoomRes = await fetch(`http://localhost:${port}/api/v1/rooms/${secretRoom.slug}`);
    assert.equal(publicRoomRes.status, 200);
    const publicRoom = await publicRoomRes.json();
    assert.equal(publicRoom.hostKey, undefined, 'hostKey must not be leaked to unauthenticated callers');
    assert.equal(publicRoom.password, undefined);

    // 2. Path Traversal rejection on recordings file endpoint
    const traversalKey = encodeURIComponent('../../etc/passwd');
    const traversalRes = await fetch(`http://localhost:${port}/api/v1/recordings/file/${traversalKey}`, {
      headers: {
        'X-API-Key': instance.config.apiKey
      }
    });
    assert.equal(traversalRes.status, 400);
    const traversalErr = await traversalRes.json();
    assert.match(traversalErr.error, /path traversal/i);

    // 3. IDOR / Cross-Room boundary validation using participant token
    // Issue token for secretRoom
    const tokenRes = await fetch(`http://localhost:${port}/api/v1/rooms/${secretRoom.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'user-vault-1',
        name: 'Vault Member'
      })
    });
    const tokenData = await tokenRes.json();

    // Attempt to access chat history of another room ('other-room-id') using this token
    const idorRes = await fetch(`http://localhost:${port}/api/v1/rooms/other-room-id/chat`, {
      headers: {
        'Authorization': `Bearer ${tokenData.token}`
      }
    });
    assert.equal(idorRes.status, 403, 'Cross-room access must be blocked with 403 Forbidden');

    // 4. Constant-Time Timing Safe API Key rejection
    const invalidKeyRes = await fetch(`http://localhost:${port}/api/v1/rooms`, {
      headers: {
        'X-API-Key': 'nexusrtc-wrong-key'
      }
    });
    assert.equal(invalidKeyRes.status, 401);

    // 5. WebSocket message rate limiting
    const wsUrl = `ws://localhost:${port}/ws`;
    const floodWs = new WebSocket(wsUrl);
    await new Promise((resolve) => floodWs.on('open', resolve));

    // Join room first
    const joinedPromise = new Promise<any>((resolve) => {
      floodWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.JOINED) resolve(p.payload);
      });
    });
    floodWs.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: tokenData.token } }));
    await joinedPromise;

    // Send rapid burst of messages exceeding 50 msgs/sec
    let rateLimitTriggered = false;
    floodWs.on('message', (msg) => {
      const p = JSON.parse(msg.toString());
      if (p.event === NexusEvents.ERROR && p.payload.message === 'Rate limit exceeded') {
        rateLimitTriggered = true;
      }
    });

    for (let i = 0; i < 60; i++) {
      floodWs.send(JSON.stringify({ event: NexusEvents.HAND_RAISED, payload: { isHandRaised: false } }));
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(rateLimitTriggered, true, 'WebSocket server must enforce rate limiting against flooding');

    floodWs.close();
  });
});
