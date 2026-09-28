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
  let hostKey = '';
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
    assert.ok(data.hostKey);
    assert.equal(data.title, 'Weekly Standup');
    roomId = data.id;
    roomSlug = data.slug;
    hostKey = data.hostKey;
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
        role: 'host',
        hostKey: hostKey
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

    // Test G: Regular participant token attempting REST host-only operations
    const guestHeaders = {
      'Authorization': `Bearer ${guestExploitData.token}`,
      'Content-Type': 'application/json'
    };

    // 1. Update room permissions
    const restPermRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/permissions`, {
      method: 'PUT',
      headers: guestHeaders,
      body: JSON.stringify({ locks: { lockMicrophones: true } })
    });
    assert.equal(restPermRes.status, 403, 'Guest must get 403 on PUT permissions');

    // 2. Start recording via REST
    const restRecRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.id}/recordings/start`, {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({})
    });
    assert.equal(restRecRes.status, 403, 'Guest must get 403 on POST recordings/start');

    // 3. Stop recording via REST
    const restRecStopRes = await fetch(`http://localhost:${port}/api/v1/recordings/fake-rec-id/stop`, {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({})
    });
    assert.equal(restRecStopRes.status, 403, 'Guest must get 403 on POST recordings/:id/stop');

    // 4. Create breakout room via REST
    const restBreakoutRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.id}/breakouts`, {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({ name: 'Illegal Breakout' })
    });
    assert.equal(restBreakoutRes.status, 403, 'Guest must get 403 on POST breakouts');

    // 5. Start live broadcast via REST
    const restBroadcastRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.id}/broadcast/start`, {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({ streamUrl: 'rtmp://example.com/live', streamKey: 'secret' })
    });
    assert.equal(restBroadcastRes.status, 403, 'Guest must get 403 on POST broadcast/start');

    // 6. View room recordings via REST without permissions
    const restRecListRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.id}/recordings`, {
      headers: guestHeaders
    });
    assert.equal(restRecListRes.status, 403, 'Guest must get 403 on GET recordings');

    // Test H: Host Impersonation Protection
    // An attacker requests a token explicitly setting participantId = room.hostId ('real-host-123') without hostKey
    const hijackRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'real-host-123',
        name: 'Imposter Bob'
      })
    });
    assert.equal(hijackRes.status, 200);
    const hijackData = await hijackRes.json();
    assert.equal(hijackData.participant.role, 'participant');
    assert.notEqual(hijackData.participant.id, 'real-host-123', 'Attacker must be reassigned a random ID to prevent host impersonation');

    // Test I: Protection against moderating the Host
    // Create a moderator user who has 'moderation:kick_participants' and 'moderation:mute_others'
    const modRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'mod-user-1',
        name: 'Moderator User',
        role: 'moderator',
        hostKey: room.hostKey
      })
    });
    assert.equal(modRes.status, 200);
    const modData = await modRes.json();
    assert.equal(modData.participant.role, 'moderator');

    // Moderator connects via WebSocket
    const modWs = new WebSocket(wsUrl);
    await new Promise((resolve) => modWs.on('open', resolve));
    const modJoinPromise = new Promise<any>((resolve) => {
      modWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.JOINED) resolve(p.payload);
      });
    });
    modWs.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: modData.token } }));
    await modJoinPromise;

    // Moderator attempts to kick the room host -> Server MUST reject!
    const modKickHostPromise = new Promise<any>((resolve) => {
      modWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });
    modWs.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: 'real-host-123',
        action: 'kick'
      }
    }));
    const modKickErr = await modKickHostPromise;
    assert.match(modKickErr.message, /Cannot moderate or kick the room host/);

    // Moderator attempts to mute the room host -> Server MUST reject!
    const modMuteHostPromise = new Promise<any>((resolve) => {
      modWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });
    modWs.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: 'real-host-123',
        action: 'mute-audio'
      }
    }));
    const modMuteErr = await modMuteHostPromise;
    assert.match(modMuteErr.message, /Cannot moderate or kick the room host/);
    modWs.close();

    // Test J: Disabled Room Features override all roles (even Host)
    const restrictedRoomRes = await fetch(`http://localhost:${port}/api/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        title: 'Restricted Capabilities Room',
        hostId: 'strict-host-1',
        features: {
          recordingEnabled: false,
          breakoutRoomsEnabled: false
        }
      })
    });
    assert.equal(restrictedRoomRes.status, 201);
    const restrictedRoom = await restrictedRoomRes.json();

    const strictHostRes = await fetch(`http://localhost:${port}/api/v1/rooms/${restrictedRoom.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'strict-host-1',
        name: 'Strict Host',
        role: 'host',
        hostKey: restrictedRoom.hostKey
      })
    });
    const strictHostData = await strictHostRes.json();
    assert.equal(strictHostData.participant.role, 'host');
    // Ensure effective permissions have recording and breakout stripped despite role: 'host'
    assert.equal(strictHostData.participant.permissions.includes('session:start_recording'), false);
    assert.equal(strictHostData.participant.permissions.includes('breakout:create'), false);

    // Host attempting REST recording start on a room where recording is disabled -> 403 Forbidden
    const strictHostRecRes = await fetch(`http://localhost:${port}/api/v1/rooms/${restrictedRoom.id}/recordings/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${strictHostData.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    assert.equal(strictHostRecRes.status, 403);
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

  await t.test('Adversarial Security Red-Team: Complete Attack Matrix', async () => {
    // 1. Custom Role Privilege Escalation:
    // Create a room that defines a custom privileged role 'co-host'
    const roomRes = await fetch(`http://localhost:${port}/api/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        title: 'High Security Summit',
        hostId: 'real-owner-uuid',
        permissions: {
          roles: {
            'co-host': [
              'moderation:kick_participants',
              'moderation:mute_others',
              'session:update_permissions'
            ]
          }
        }
      })
    });
    assert.equal(roomRes.status, 201);
    const room = await roomRes.json();

    // A malicious guest requests token with role: 'co-host' without hostKey
    const forgeRoleRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'untrusted-guest-1',
        name: 'Sneaky Guest',
        role: 'co-host' // Attempting to escalate to custom role
      })
    });
    assert.equal(forgeRoleRes.status, 200);
    const forgeRoleData = await forgeRoleRes.json();
    assert.equal(forgeRoleData.participant.role, 'participant', 'Untrusted caller attempting to claim custom privileged role must be authoritatively demoted to participant');
    assert.equal(forgeRoleData.participant.permissions.includes('moderation:kick_participants'), false);

    // 2. Participant Identity Spoofing & Hijack:
    // Generate real host token
    const realHostRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'real-owner-uuid',
        name: 'The Boss',
        role: 'host',
        hostKey: room.hostKey
      })
    });
    assert.equal(realHostRes.status, 200);
    const realHostData = await realHostRes.json();

    // Generate Moderator token
    const modRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'trusted-mod-1',
        name: 'Moderator One',
        role: 'moderator',
        hostKey: room.hostKey
      })
    });
    assert.equal(modRes.status, 200);
    const modData = await modRes.json();

    // Malicious caller tries to claim participantId = 'trusted-mod-1' without hostKey
    const spoofModRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'trusted-mod-1',
        name: 'Imposter Mod'
      })
    });
    assert.equal(spoofModRes.status, 200);
    const spoofModData = await spoofModRes.json();
    assert.equal(spoofModData.participant.role, 'participant');
    assert.notEqual(spoofModData.participant.id, 'trusted-mod-1', 'Caller without hostKey cannot hijack active moderator ID');

    // 3. Multi-Session / Multi-Tab / Reconnect Resilience:
    const wsUrl = `ws://localhost:${port}/ws`;
    const hostTab1Ws = new WebSocket(wsUrl);
    const hostTab2Ws = new WebSocket(wsUrl);
    await Promise.all([
      new Promise((resolve) => hostTab1Ws.on('open', resolve)),
      new Promise((resolve) => hostTab2Ws.on('open', resolve))
    ]);

    // Host connects Tab 1
    const hostTab1JoinPromise = new Promise<any>((resolve) => {
      hostTab1Ws.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.JOINED) resolve(p.payload);
      });
    });
    hostTab1Ws.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: realHostData.token } }));
    await hostTab1JoinPromise;

    // Host connects Tab 2 (same token & participantId)
    const hostTab2JoinPromise = new Promise<any>((resolve) => {
      hostTab2Ws.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.JOINED) resolve(p.payload);
      });
    });
    hostTab2Ws.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: realHostData.token } }));
    await hostTab2JoinPromise;

    // Connect guest to observe presence
    const guestWs = new WebSocket(wsUrl);
    await new Promise((resolve) => guestWs.on('open', resolve));
    const guestJoinPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.JOINED) resolve(p.payload);
      });
    });
    guestWs.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: forgeRoleData.token } }));
    await guestJoinPromise;

    // Host closes Tab 1 -> Guest MUST NOT receive PARTICIPANT_LEFT because Tab 2 is still active!
    let guestReceivedLeft = false;
    guestWs.on('message', (msg) => {
      const p = JSON.parse(msg.toString());
      if (p.event === NexusEvents.PARTICIPANT_LEFT && p.payload.participantId === 'real-owner-uuid') {
        guestReceivedLeft = true;
      }
    });

    hostTab1Ws.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(guestReceivedLeft, false, 'Closing one tab/device of a multi-session host must not evict the host from the room');

    // Host in Tab 2 can still perform actions (e.g. toggle mic lock)
    hostTab2Ws.send(JSON.stringify({
      event: NexusEvents.UPDATE_PERMISSIONS,
      payload: { locks: { lockMicrophones: true } }
    }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 4. Token Replay After Eviction (Kicked Participant Reconnect Protection):
    // Host in Tab 2 kicks the guest
    const guestKickedPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.PARTICIPANT_MODERATED) resolve(p.payload);
      });
    });

    hostTab2Ws.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: forgeRoleData.participant.id,
        action: 'kick'
      }
    }));

    const kickedPayload = await guestKickedPromise;
    assert.equal(kickedPayload.action, 'kick');

    // Wait for socket to close
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Evicted guest attempts to reconnect using the same token
    const reconnectedWs = new WebSocket(wsUrl);
    await new Promise((resolve) => reconnectedWs.on('open', resolve));
    const evictedErrPromise = new Promise<any>((resolve) => {
      reconnectedWs.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });

    reconnectedWs.send(JSON.stringify({
      event: NexusEvents.JOIN,
      payload: { token: forgeRoleData.token }
    }));

    const evictedErr = await evictedErrPromise;
    assert.match(evictedErr.message, /Participant has been evicted from this session/);
    reconnectedWs.close();

    // Evicted guest attempts to call REST endpoint with the evicted token
    const evictedRestRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/permissions`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${forgeRoleData.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ locks: { lockMicrophones: false } })
    });
    assert.equal(evictedRestRes.status, 403, 'Evicted participant token must be rejected with 403 on REST endpoints');

    // 5. Peer Moderator and Immunity Hierarchy Tests:
    // Create Moderator Two
    const mod2Res = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': instance.config.apiKey
      },
      body: JSON.stringify({
        participantId: 'trusted-mod-2',
        name: 'Moderator Two',
        role: 'moderator',
        hostKey: room.hostKey
      })
    });
    const mod2Data = await mod2Res.json();

    const mod1Ws = new WebSocket(wsUrl);
    const mod2Ws = new WebSocket(wsUrl);
    await Promise.all([
      new Promise((resolve) => mod1Ws.on('open', resolve)),
      new Promise((resolve) => mod2Ws.on('open', resolve))
    ]);

    const m1Join = new Promise<any>((resolve) => mod1Ws.on('message', (msg) => {
      const p = JSON.parse(msg.toString());
      if (p.event === NexusEvents.JOINED) resolve(p.payload);
    }));
    mod1Ws.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: modData.token } }));
    await m1Join;

    const m2Join = new Promise<any>((resolve) => mod2Ws.on('message', (msg) => {
      const p = JSON.parse(msg.toString());
      if (p.event === NexusEvents.JOINED) resolve(p.payload);
    }));
    mod2Ws.send(JSON.stringify({ event: NexusEvents.JOIN, payload: { token: mod2Data.token } }));
    await m2Join;

    // Moderator 1 attempts to kick peer Moderator 2 -> MUST BE REJECTED!
    const peerKickErrPromise = new Promise<any>((resolve) => {
      mod1Ws.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });
    mod1Ws.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: 'trusted-mod-2',
        action: 'kick'
      }
    }));
    const peerKickErr = await peerKickErrPromise;
    assert.match(peerKickErr.message, /Moderators cannot be moderated by peer moderators or participants/);

    // Moderator 1 attempts to mute peer Moderator 2 -> MUST BE REJECTED!
    const peerMuteErrPromise = new Promise<any>((resolve) => {
      mod1Ws.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });
    mod1Ws.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: 'trusted-mod-2',
        action: 'mute-audio'
      }
    }));
    const peerMuteErr = await peerMuteErrPromise;
    assert.match(peerMuteErr.message, /Moderators cannot be moderated by peer moderators or participants/);

    // Moderator 1 attempts to kick themselves -> MUST BE REJECTED!
    const selfKickErrPromise = new Promise<any>((resolve) => {
      mod1Ws.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });
    mod1Ws.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: 'trusted-mod-1',
        action: 'kick'
      }
    }));
    const selfKickErr = await selfKickErrPromise;
    assert.match(selfKickErr.message, /Cannot moderate self/);

    // Moderator 1 attempts to alter roles or strip host permissions via REST
    const modDemoteHostRes = await fetch(`http://localhost:${port}/api/v1/rooms/${room.slug}/permissions`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${modData.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        participantOverrides: {
          'real-owner-uuid': [] // Attempting to strip host of all permissions
        }
      })
    });
    assert.equal(modDemoteHostRes.status, 403, 'Non-host participant cannot modify role definitions or participant overrides');

    // 6. Host kicks Moderator 1 -> Allowed (Host strictly outranks Moderator)
    const mod1KickedPromise = new Promise<any>((resolve) => {
      mod1Ws.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.PARTICIPANT_MODERATED) resolve(p.payload);
      });
    });
    hostTab2Ws.send(JSON.stringify({
      event: NexusEvents.MODERATE_PARTICIPANT,
      payload: {
        targetParticipantId: 'trusted-mod-1',
        action: 'kick'
      }
    }));
    const mod1Kicked = await mod1KickedPromise;
    assert.equal(mod1Kicked.action, 'kick');

    // 7. Duplicate Socket Join Rejection
    const dupJoinErrPromise = new Promise<any>((resolve) => {
      hostTab2Ws.on('message', (msg) => {
        const p = JSON.parse(msg.toString());
        if (p.event === NexusEvents.ERROR) resolve(p.payload);
      });
    });
    hostTab2Ws.send(JSON.stringify({
      event: NexusEvents.JOIN,
      payload: { token: realHostData.token }
    }));
    const dupJoinErr = await dupJoinErrPromise;
    assert.match(dupJoinErr.message, /Session already joined on this connection/);

    // Cleanup open sockets
    hostTab2Ws.close();
    mod1Ws.close();
    mod2Ws.close();
    guestWs.close();
  });

  await t.test('Invitation Flow & Adversarial Tampering: Complete Lifecycle and Security', async () => {
    // 1. Host creates legitimate participant invitation
    const createPartInvRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        role: 'participant',
        expiresInSeconds: 3600,
        maxUses: 10
      })
    });
    assert.equal(createPartInvRes.status, 201);
    const partInv = await createPartInvRes.json();
    assert.ok(partInv.code);
    assert.equal(partInv.role, 'participant');
    assert.equal(partInv.status, 'active');
    assert.equal(partInv.usesCount, 0);

    // 2. Host creates legitimate viewer invitation
    const createViewerInvRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        role: 'viewer',
        expiresInSeconds: 3600
      })
    });
    assert.equal(createViewerInvRes.status, 201);
    const viewerInv = await createViewerInvRes.json();
    assert.ok(viewerInv.code);
    assert.equal(viewerInv.role, 'viewer');

    // 3. Attempting to create an invitation with elevated role ('host' or 'moderator') must be rejected
    const badRoleRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        role: 'host'
      })
    });
    assert.equal(badRoleRes.status, 400);

    // 4. Non-host participant attempting to create an invitation must be rejected with 403
    const nonHostCreateRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${participantToken}`
      },
      body: JSON.stringify({
        role: 'participant'
      })
    });
    assert.equal(nonHostCreateRes.status, 403);

    // 5. Public lookup of invitation code validates details without leaking secrets
    const publicLookupRes = await fetch(`http://localhost:${port}/api/v1/invitations/${partInv.code}`);
    assert.equal(publicLookupRes.status, 200);
    const publicData = await publicLookupRes.json();
    assert.equal(publicData.code, partInv.code);
    assert.equal(publicData.role, 'participant');
    assert.equal(publicData.isValid, true);
    assert.equal(publicData.hostKey, undefined);
    assert.equal(publicData.password, undefined);

    // 6. Legitimate join using participant invitation code (without requiring API key)
    const joinRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Honest Guest',
        inviteCode: partInv.code
      })
    });
    assert.equal(joinRes.status, 200);
    const joinData = await joinRes.json();
    assert.ok(joinData.token);
    assert.equal(joinData.participant.role, 'participant');
    assert.ok(joinData.participant.permissions.includes('media:send_audio'));

    // Verify usage count incremented
    const listRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/invitations`, {
      headers: { 'Authorization': `Bearer ${hostToken}` }
    });
    const listData = await listRes.json();
    const updatedPartInv = listData.find((i: any) => i.code === partInv.code);
    assert.equal(updatedPartInv.usesCount, 1);

    // 7. Malicious tampering: Attacker joins with inviteCode and attempts to claim role: 'host'
    const exploitHostRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Guest',
        inviteCode: partInv.code,
        role: 'host' // Tampered role parameter
      })
    });
    assert.equal(exploitHostRes.status, 200);
    const exploitData = await exploitHostRes.json();
    // Authoritatively enforced: must remain participant, NOT host!
    assert.equal(exploitData.participant.role, 'participant');
    assert.ok(!exploitData.participant.permissions.includes('session:update_permissions'));

    // 8. Malicious tampering: Attacker uses viewer invitation and requests role: 'participant'
    const exploitViewerRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sneaky Viewer',
        inviteCode: viewerInv.code,
        role: 'participant'
      })
    });
    assert.equal(exploitViewerRes.status, 200);
    const exploitViewerData = await exploitViewerRes.json();
    // Strictly enforced: locked to viewer!
    assert.equal(exploitViewerData.participant.role, 'viewer');
    assert.ok(!exploitViewerData.participant.permissions.includes('media:send_audio'));
    assert.ok(!exploitViewerData.participant.permissions.includes('media:send_video'));

    // 9. Expiration: Create invitation expiring in 1 second
    const expInvRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        role: 'participant',
        expiresInSeconds: 1
      })
    });
    const expInv = await expInvRes.json();
    // Wait for expiration
    await new Promise((r) => setTimeout(r, 1100));

    const expJoinRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Late Guest',
        inviteCode: expInv.code
      })
    });
    assert.equal(expJoinRes.status, 400);
    const expErr = await expJoinRes.json();
    assert.match(expErr.error, /expired/i);

    // 10. Max Uses Limit: Create single-use invitation
    const singleUseRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      },
      body: JSON.stringify({
        role: 'participant',
        maxUses: 1
      })
    });
    const singleInv = await singleUseRes.json();

    // First use succeeds
    const firstJoinRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'First Guest',
        inviteCode: singleInv.code
      })
    });
    assert.equal(firstJoinRes.status, 200);

    // Second use rejected
    const secondJoinRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second Guest',
        inviteCode: singleInv.code
      })
    });
    assert.equal(secondJoinRes.status, 400);
    const secondErr = await secondJoinRes.json();
    assert.match(secondErr.error, /maximum|limit|expired/i);

    // 11. Revocation: Non-host cannot revoke, Host can revoke, and subsequent joins fail
    const nonHostRevokeRes = await fetch(`http://localhost:${port}/api/v1/invitations/${partInv.code}/revoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${participantToken}`
      }
    });
    assert.equal(nonHostRevokeRes.status, 403);

    const hostRevokeRes = await fetch(`http://localhost:${port}/api/v1/invitations/${partInv.code}/revoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hostToken}`
      }
    });
    assert.equal(hostRevokeRes.status, 200);

    const revokedJoinRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attempted Join',
        inviteCode: partInv.code
      })
    });
    assert.equal(revokedJoinRes.status, 400);
    const revokedErr = await revokedJoinRes.json();
    assert.match(revokedErr.error, /revoked/i);

    // 12. Invalid arbitrary inviteCode is rejected
    const invalidCodeRes = await fetch(`http://localhost:${port}/api/v1/rooms/${roomSlug}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hacker',
        inviteCode: 'completely-fake-code-9999'
      })
    });
    assert.equal(invalidCodeRes.status, 400);
    const invalidErr = await invalidCodeRes.json();
    assert.match(invalidErr.error, /invalid/i);
  });
});
