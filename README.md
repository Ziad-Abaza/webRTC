# NexusRTC: Universal WebRTC Communication Engine

A production-grade, framework-agnostic real-time communication platform designed as reusable infrastructure for web and mobile applications (Laravel, Node.js, React, Vue, Vanilla JS, Flutter via REST/WS).

---

## 🌟 Key Capabilities

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
            'hostId' => auth()->id() ?? 'host-1',
            'features' => [
                'recordingEnabled' => true,
                'chatEnabled' => true,
                'breakoutRoomsEnabled' => true,
                'screenShareEnabled' => true
            ]
        ]);

        return redirect()->route('meeting.join', ['slug' => $room->slug]);
    }

    // Join room & issue authorized participant token
    public function join(string $slug)
    {
        $session = NexusRTC::generateJoinToken($slug, [
            'participantId' => (string) auth()->id(),
            'name' => auth()->user()->name ?? 'Participant',
            'role' => auth()->user()->is_admin ? 'host' : 'participant'
        ]);

        return view('meeting', [
            'token' => $session['token'],
            'media' => $session['media'],
            'wsUrl' => config('nexusrtc.ws_url')
        ]);
    }
}
```

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

### 1. Server, Database Persistence & Signaling E2E Tests:
```bash
node --test packages/server/dist/tests/server.test.js
```
*Result: 4/4 passing tests verifying REST room lifecycle, token issuance, multi-participant WebSocket signaling, live chat broadcast, raise-hand notifications, breakout rooms, and recording start/stop with SQLite persistence.*

### 2. Client SDK Unit Tests:
```bash
node --test packages/client/dist/tests/client.test.js
```
*Result: 4/4 passing tests verifying event dispatching, chat manager messaging, and breakout room lifecycle.*

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
*Result: 2/2 passing feature tests verifying full end-to-end meeting creation, join token issuance, blade template rendering with bundled Web SDK, and participant guest flows.*

