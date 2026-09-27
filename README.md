# NexusRTC: Universal WebRTC Communication Engine

A production-grade, framework-agnostic real-time communication platform designed as reusable infrastructure for web and mobile applications (Laravel, Node.js, React, Vue, Vanilla JS, Flutter via REST/WS).

---

## 🌟 Key Capabilities

- **Granular Permissions & Role Capability Control:** Granular, extensible policy system. The session owner/administrator has complete control over permissions per room, per role, and per participant (microphone, camera, screen sharing, chat, private messaging, breakout creation/joining, recording, broadcasting, and moderation). Permissions are authoritatively enforced by the server on all signaling actions, with client UI reflecting effective permissions and dynamic room locks.
- **Group Video Meetings & Private 1-on-1 Rooms:** Configurable room lifecycle, access tokens, and feature toggles.
- **Pluggable Media Engine:** Clean `IMediaProvider` abstraction. Shipped with initial Jitsi Meet (RFC 7519 / JaaS JWT compatible) media SFU adapter, easily swappable with Mediasoup, LiveKit, or native WebRTC mesh.
- **Pluggable Database & Storage:** `IDatabaseAdapter` (Memory, SQLite, PostgreSQL ready) and `IStorageProvider` (Local Filesystem, S3/MinIO compatible).
- **Screen Sharing & Media Controls:** Audio/video muting, desktop screen sharing, and participant state broadcasting.
- **Real-Time Synchronized Chat:** In-meeting room chat and direct private messaging.
- **Raise Hand & Moderation Queue:** Host/moderator controls for muting, kicking, and hand raising order.
- **Breakout Rooms:** Dynamic subroom creation, participant assignment, automatic return, and host announcements across all breakout rooms.
- **Server-Side Recording:** Start/stop recording lifecycle, asset storage persistence, and secure download URL generation.
- **Live Broadcasting:** RTMP live streaming integration and status tracking.
- **Multi-Stack Consumption:**
  - **Node.js/TypeScript Engine Server:** REST API + WebSocket Signaling Server (`@nexusrtc/server`).
  - **Framework-Agnostic Web SDK:** Pure TypeScript client (`@nexusrtc/client`).
  - **PHP / Laravel Package:** Composer SDK with ServiceProvider and Facades (`nexusrtc/client`).
  - **Flutter / Mobile Ready:** Connects directly via standard HTTP REST and WebSocket JSON payloads without requiring specialized proprietary mobile SDKs.

---

## 🏗️ Architecture & Package Layout

```
nexusrtc/
├── packages/
│   ├── core/                  # Shared domain types, provider interfaces, events
│   │   ├── src/types.ts       # Room, Participant, ChatMessage, BreakoutRoom, Recording
│   │   ├── src/interfaces.ts  # IMediaProvider, IStorageProvider, IDatabaseAdapter
│   │   └── src/events.ts      # NexusEvents protocol constants
│   ├── server/                # Standalone Engine Server (REST + WebSocket)
│   │   ├── src/services/      # RoomService, RecordingService, BreakoutService, BroadcastService
│   │   ├── src/media/         # JitsiMediaProvider
│   │   ├── src/storage/       # LocalStorageProvider
│   │   ├── src/db/            # MemoryDatabaseAdapter
│   │   └── src/ws/            # WebSocketSignalingServer
│   └── client/                # Framework-agnostic TypeScript Client SDK
│       ├── src/NexusClient.ts # Master client orchestrator
│       ├── src/MediaManager.ts# Jitsi & WebRTC media wrapper
│       ├── src/ChatManager.ts # Real-time chat manager
│       └── src/BreakoutManager.ts # Subrooms manager
├── sdk/
│   └── php/                   # Composer package `nexusrtc/client`
│       ├── src/NexusRtcClient.php
│       └── src/Laravel/       # NexusRtcServiceProvider & Facades\NexusRTC
└── apps/
    └── laravel-demo/          # Independent Laravel application proving full integration
        ├── app/Http/Controllers/MeetingController.php
        ├── resources/views/meetings/index.blade.php
        ├── resources/views/meetings/room.blade.php
        └── tests/Feature/NexusRtcIntegrationTest.php
```

---

## 🚀 Quickstart Guide

### 1. Start the NexusRTC Engine Server

```bash
cd packages/server
npm run build
npm start
```
The server will start listening at:
- REST API: `http://localhost:4000/api/v1`
- WebSocket Signaling: `ws://localhost:4000/ws`

### Environment Configuration (`packages/server/.env` or system env):
```env
NEXUS_PORT=4000
NEXUS_HOST=0.0.0.0
NEXUS_API_KEY=nexusrtc-master-api-key
NEXUS_JWT_SECRET=nexusrtc-super-secret-jwt-key-minimum-32-chars-long
NEXUS_MEDIA_PROVIDER=jitsi
NEXUS_DATABASE_ADAPTER=sqlite
NEXUS_SQLITE_PATH=./storage/nexusrtc.sqlite
JITSI_DOMAIN=meet.jit.si
STORAGE_LOCAL_DIR=./storage/recordings
```

---

## 💻 Consuming from Web (React, Vue, Vanilla TS/JS)

```typescript
import { NexusClient } from '@nexusrtc/client';

// 1. Initialize client with WebSocket URL and Room Token
const client = new NexusClient({
  wsUrl: 'ws://localhost:4000/ws',
  token: participantJwtToken
});

// 2. Listen to real-time events
client.on('joined', (session) => {
  console.log('Joined room:', session.room.title);
  // Attach video container
  client.media.attachJitsi(document.getElementById('video-container'), session.media);
});

client.on('chatMessage', (msg) => {
  console.log(`[Chat] ${msg.senderName}: ${msg.content}`);
});

client.on('handRaised', (participant) => {
  console.log(`✋ ${participant.name} raised their hand`);
});

// 3. User Actions
client.media.toggleAudio();
client.media.toggleVideo();
client.media.toggleScreenShare();
client.chat.send('Hello everyone!');
client.toggleRaiseHand();

// Breakout rooms (Host)
client.breakout.createBreakout('Sub-team A', 15);
```

---

## 🐘 Consuming from PHP & Laravel

### Installation in any Laravel Project

1. Require the package via Composer:
```bash
composer require nexusrtc/client
```

2. Publish the config file:
```bash
php artisan vendor:publish --tag=nexusrtc-config
```

3. Set your environment variables in `.env`:
```env
NEXUSRTC_BASE_URL=http://127.0.0.1:4000
NEXUSRTC_API_KEY=nexusrtc-master-api-key
NEXUSRTC_WS_URL=ws://127.0.0.1:4000/ws
```

### Usage in Laravel Controllers

```php
use NexusRTC\Client\Laravel\Facades\NexusRTC;

class ConferenceController extends Controller
{
    // Create a new meeting room
    public function store()
    {
        $room = NexusRTC::createRoom([
            'title' => 'Weekly Executive Sync',
            'hostId' => (string) auth()->id(),
            'features' => [
                'recordingEnabled' => true,
                'chatEnabled' => true,
                'breakoutRoomsEnabled' => true,
                'screenShareEnabled' => true
            ]
        ]);

        // Securely store the host credentials in session
        session()->put("room_host_{$room->slug}", [
            'hostId' => $room->hostId,
            'hostKey' => $room->hostKey,
        ]);

        return redirect()->route('meeting.join', ['slug' => $room->slug]);
    }

    // Join room & issue authorized participant token
    public function join(string $slug)
    {
        // Authoritative verification: Only provide hostKey if session proves ownership
        $hostSession = session()->get("room_host_{$slug}");
        $isHost = is_array($hostSession) && !empty($hostSession['hostKey']);

        $tokenPayload = [
            'participantId' => (string) (auth()->id() ?? 'guest-' . uniqid()),
            'name' => auth()->user()->name ?? 'Participant',
        ];

        if ($isHost) {
            $tokenPayload['role'] = 'host';
            $tokenPayload['participantId'] = $hostSession['hostId'];
            $tokenPayload['hostKey'] = $hostSession['hostKey'];
        } else {
            $tokenPayload['role'] = 'participant';
        }

        $session = NexusRTC::generateJoinToken($slug, $tokenPayload);

        return view('meeting', [
            'token' => $session['token'],
            'media' => $session['media'],
            'wsUrl' => config('nexusrtc.ws_url')
        ]);
    }
}
```

---

## 🔒 Security Architecture: Authoritative Server-Side Authorization

NexusRTC enforces strict zero-trust security at the server level:
- **Timing-Safe Authentication**: API key verification uses constant-time comparisons (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.
- **Authoritative Role Derivation (`RoomService`)**: Host and Moderator privileges cannot be claimed by passing `role: host` in client payloads or query parameters. The engine server verifies `hostId` or validates the room's secret `hostKey` before granting elevated roles. Unverified claims are automatically demoted to `participant`.
- **Path Traversal & Storage Boundary Defense (`LocalStorageProvider`)**: File keys are validated to prevent directory traversal (`..`, absolute paths, and prefix checking) ensuring recording downloads cannot access the host filesystem.
- **Tenant & Cross-Room Boundary Enforcement (IDOR/BOLA Protection)**: Session tokens grant access strictly to their assigned room. Cross-room queries to `/rooms/:roomId/participants`, `/chat`, `/recordings`, and `/breakouts` are blocked with `403 Forbidden`.
- **Information Leakage Prevention**: Public/participant room endpoints (`GET /rooms/:idOrSlug`) sanitize sensitive internals, ensuring `hostKey` and `password` are never exposed to non-admin callers.
- **Cryptographic JWT Tokens**: Tokens are cryptographically signed using HS256 with the server's private secret. Tampered payloads or forged signatures are immediately rejected during the WebSocket handshake.
- **WebSocket Gateway Rate Limiting & Message Caps**: WebSocket connections enforce per-client message throttling (max 50 msgs/sec burst prevention) and a 64KB message payload ceiling.
- **Authoritative Capability Enforcement**: Every action (`RECORDING_START`, `RECORDING_STOP`, `MODERATE_PARTICIPANT`, `UPDATE_PERMISSIONS`, `BREAKOUT_CREATE`, `MEDIA_STATE_CHANGED`, etc.) checks the caller's authoritatively resolved capability set on every message. Unauthorized attempts are rejected with error events.

---

## 📖 API Documentation & Machine-Readable Contracts

For coding agents, AI tools, and developers, a complete machine-readable OpenAPI 3.1.0 specification is available:
- **OpenAPI Specification**: [`packages/server/docs/openapi.yaml`](file:///D:/coding/projects/web%20developer/New%20folder/packages/server/docs/openapi.yaml)
- **REST Endpoints Base**: `http://localhost:4000/api/v1`
- **Signaling WebSocket**: `ws://localhost:4000/ws`

---

## 📱 Consuming from Flutter / Mobile

Flutter and mobile apps do not require a separate mobile SDK. Mobile applications interact with NexusRTC directly:
1. **HTTP REST**: Fetch room metadata and request a session token from your backend (e.g. Laravel).
2. **WebSocket Signaling**: Connect directly to `ws://server:4000/ws` and send the standard JSON handshake:
```json
{
  "event": "nexus:join",
  "payload": { "token": "<participant_jwt_token>" }
}
```
3. **Media**: Embed via `flutter_inappwebview` rendering the Web client or connect to Jitsi Meet via Jitsi Meet Flutter SDK using the provided room credentials and JWT token.

---

## 🧪 Verification & Testing

NexusRTC includes rigorous automated test coverage across every layer of the architecture:

### 1. Server, Persistence, Permissions & Deep Security E2E Tests:
```bash
node --test packages/server/dist/tests/server.test.js
```
*Result: 7/7 passing tests verifying REST room lifecycle, token issuance, multi-participant WebSocket signaling, live chat broadcast, raise-hand notifications, breakout rooms, SQLite persistence, viewer role capability restrictions, security tests proving rejection of role forging, token tampering, path traversal protection, hostKey sanitization, IDOR cross-room access protection, and WebSocket rate limiting.*

### 2. Client SDK Unit Tests:
```bash
node --test packages/client/dist/tests/client.test.js
```
*Result: 5/5 passing tests verifying event dispatching, chat manager messaging, breakout room lifecycle, and media manager state toggles.*

### 3. PHP SDK Standalone Test Suite:
```bash
php sdk/php/tests/test_client.php
```
*Result: All SDK endpoints verified (Room CRUD, Token issuance, Breakout rooms, Recordings).*

### 4. Standalone Laravel Application Integration Proof:
```bash
cd apps/laravel-demo
php artisan test --filter=NexusRtcIntegrationTest
```
*Result: 5/5 passing tests (28 assertions) verifying full end-to-end meeting creation, join token issuance, blade template rendering with bundled Web SDK, participant guest flows, and multi-session authorization proving that regular invited participants cannot obtain or exercise host privileges.*

