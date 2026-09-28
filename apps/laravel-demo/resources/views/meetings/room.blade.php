<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $room->title }} - WebRTC Room</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        #jitsi-container iframe {
            border-radius: 0.75rem;
            width: 100% !important;
            height: 100% !important;
        }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 h-screen flex flex-col overflow-hidden">

    <!-- Top Navigation / Header -->
    <header class="h-14 border-b border-slate-800 bg-slate-900/90 px-6 flex items-center justify-between z-10">
        <div class="flex items-center space-x-3">
            <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 class="font-bold text-white text-base tracking-wide">{{ $room->title }}</h1>
            <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                slug: <strong class="text-slate-300">{{ $room->slug }}</strong>
            </span>
        </div>

        <div class="flex items-center space-x-3">
            <div id="recording-badge" class="hidden items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <span>REC</span>
            </div>

            <div class="flex items-center space-x-2 text-xs">
                <span class="text-slate-400">Signed in as:</span>
                <span class="font-semibold text-indigo-400">{{ $participant['name'] }}</span>
                <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono uppercase text-[10px]">{{ $participant['role'] }}</span>
            </div>

            @if(!empty($isHost) || $participant['role'] === 'host')
            <button id="btn-open-invite-modal" class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center space-x-1.5 shadow-sm shadow-indigo-600/30 active:scale-95">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                <span>Invite</span>
            </button>
            @endif

            <a href="{{ route('meetings.index') }}" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
                Exit Room
            </a>
        </div>
    </header>

    <!-- Main Workspace Layout -->
    <div class="flex-1 flex overflow-hidden">
        
        <!-- Video Media Area (70%) -->
        <main class="flex-1 flex flex-col p-4 bg-slate-950 relative">
            <div id="jitsi-container" class="flex-1 w-full bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800/80 flex items-center justify-center relative">
                <!-- Fallback view if external script or iframe is waiting -->
                <div id="media-placeholder" class="text-center p-6 space-y-2">
                    <div class="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-2 animate-bounce">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </div>
                    <p class="text-sm font-semibold text-slate-200">Connecting WebRTC Media Session...</p>
                    <p class="text-xs text-slate-500">Provider: {{ $room->mediaProvider }} | Room: {{ $room->slug }}</p>
                </div>
            </div>

            <!-- In-Meeting Floating Controls Bar -->
            <div class="h-16 mt-3 flex items-center justify-center space-x-3">
                <button id="btn-toggle-mic" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-2 transition">
                    <span id="mic-status-dot" class="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span id="mic-label">Unmute Mic</span>
                </button>

                <button id="btn-toggle-cam" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-2 transition">
                    <span id="cam-status-dot" class="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span id="cam-label">Start Video</span>
                </button>

                <button id="btn-toggle-screen" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-2 transition">
                    <span>Share Screen</span>
                </button>

                <button id="btn-raise-hand" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-2 transition">
                    <span>✋ Raise Hand</span>
                </button>

                @if($participant['role'] === 'host')
                <button id="btn-toggle-recording" class="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center space-x-2 transition shadow-lg shadow-rose-600/30">
                    <span id="rec-btn-label">Start Recording</span>
                </button>
                @endif
            </div>
        </main>

        <!-- Sidebar: Participants, Chat, Breakout Rooms (30%) -->
        <aside class="w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col">
            <!-- Sidebar Tabs -->
            <div class="flex border-b border-slate-800 text-xs font-semibold">
                <button id="tab-btn-chat" class="flex-1 py-3 border-b-2 border-indigo-500 text-indigo-400">
                    Chat (<span id="chat-count">0</span>)
                </button>
                <button id="tab-btn-participants" class="flex-1 py-3 text-slate-400 hover:text-slate-200">
                    Participants (<span id="participants-count">1</span>)
                </button>
                <button id="tab-btn-breakout" class="flex-1 py-3 text-slate-400 hover:text-slate-200">
                    Breakout
                </button>
            </div>

            <!-- Tab Panels -->
            <div class="flex-1 flex flex-col overflow-hidden">
                
                <!-- Chat Panel -->
                <div id="panel-chat" class="flex-1 flex flex-col p-4 overflow-hidden">
                    <div id="chat-messages" class="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                        <div class="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400">
                            Welcome to <strong>{{ $room->title }}</strong>. Chat is encrypted and synced via WebRTC signaling.
                        </div>
                    </div>

                    <form id="chat-form" class="mt-3 flex space-x-2">
                        <input id="chat-input" type="text" placeholder="Type a message..." required
                            class="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <button type="submit" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold">
                            Send
                        </button>
                    </form>
                </div>

                <!-- Participants Panel -->
                <div id="panel-participants" class="hidden flex-1 overflow-y-auto p-4 space-y-4">
                    <div id="host-controls" class="hidden p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
                        <span class="font-bold text-slate-300 uppercase tracking-wider block text-[10px]">Room Security & Locks</span>
                        <div class="grid grid-cols-2 gap-2">
                            <button id="btn-lock-mics" class="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition text-center">
                                Lock All Mics
                            </button>
                            <button id="btn-lock-cams" class="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition text-center">
                                Lock All Cameras
                            </button>
                            <button id="btn-lock-screen" class="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition text-center">
                                Lock Screen Share
                            </button>
                            <button id="btn-lock-chat" class="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition text-center">
                                Lock Chat
                            </button>
                        </div>
                    </div>
                    @if(!empty($isHost) || $participant['role'] === 'host')
                    <div class="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
                        <div>
                            <span class="font-semibold text-slate-200 text-xs block">Invite People</span>
                            <span class="text-[10px] text-slate-400 block">Share secure link with guests</span>
                        </div>
                        <button id="btn-quick-invite" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition active:scale-95">
                            + Invite
                        </button>
                    </div>
                    @endif

                    <div>
                        <span class="font-bold text-slate-400 uppercase tracking-wider block text-[11px] mb-2">Participant List</span>
                        <div id="participants-list" class="space-y-2">
                            <!-- Populated by JS SDK -->
                        </div>
                    </div>
                </div>

                <!-- Breakout Rooms Panel -->
                <div id="panel-breakout" class="hidden flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                    @if($participant['role'] === 'host')
                    <div class="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-3">
                        <span class="font-bold text-slate-200 uppercase tracking-wider block text-[11px]">Create Breakout Room</span>
                        <input id="breakout-name-input" type="text" placeholder="Room Name (e.g. Brainstorm A)" 
                            class="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:ring-1 focus:ring-indigo-500">
                        <button id="btn-create-breakout" class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold transition">
                            Launch Breakout Room
                        </button>
                    </div>
                    @endif

                    <div>
                        <span class="font-bold text-slate-400 uppercase tracking-wider block text-[11px] mb-2">Active Breakouts</span>
                        <div id="breakout-list" class="space-y-2">
                            <p class="text-slate-500 italic">No breakout rooms active.</p>
                        </div>
                    </div>
                </div>

            </div>
        </aside>

    </div>

    <!-- Invitation Modal -->
    <div id="invite-modal" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <h3 class="font-bold text-white text-sm">Invite to {{ $room->title }}</h3>
                </div>
                <button id="btn-close-invite-modal" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Modal Tabs -->
            <div class="flex border-b border-slate-800 text-xs font-semibold px-6 bg-slate-950/40">
                <button id="invite-tab-create" class="py-3 border-b-2 border-indigo-500 text-indigo-400 mr-6">
                    Create New Link
                </button>
                <button id="invite-tab-manage" class="py-3 text-slate-400 hover:text-slate-200">
                    Active Invitations (<span id="modal-invitations-count">0</span>)
                </button>
            </div>

            <div class="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
                <!-- Panel 1: Create Invitation -->
                <div id="invite-panel-create" class="space-y-4">
                    <div>
                        <label class="block font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-2">Participant Access Role</label>
                        <div class="grid grid-cols-2 gap-3">
                            <label class="flex flex-col p-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 cursor-pointer transition">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="font-bold text-slate-200 text-xs">Participant</span>
                                    <input type="radio" name="invite-role" value="participant" checked class="text-indigo-600 focus:ring-indigo-500">
                                </div>
                                <span class="text-[11px] text-slate-400">Can speak, show camera, and use group chat.</span>
                            </label>

                            <label class="flex flex-col p-3 rounded-xl border border-slate-700 bg-slate-800/60 cursor-pointer transition">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="font-bold text-slate-200 text-xs">Viewer</span>
                                    <input type="radio" name="invite-role" value="viewer" class="text-indigo-600 focus:ring-indigo-500">
                                </div>
                                <span class="text-[11px] text-slate-400">Read-only attendee. Mic & camera disabled.</span>
                            </label>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-2">Link Expiration</label>
                            <select id="invite-expiry" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-indigo-500">
                                <option value="3600">Expires in 1 hour</option>
                                <option value="86400" selected>Expires in 24 hours</option>
                                <option value="604800">Expires in 7 days</option>
                                <option value="">No Expiration</option>
                            </select>
                        </div>

                        <div>
                            <label class="block font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-2">Usage Limit</label>
                            <select id="invite-max-uses" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-indigo-500">
                                <option value="" selected>Unlimited Joins</option>
                                <option value="1">Single-Use (1 Person)</option>
                                <option value="5">Up to 5 Persons</option>
                                <option value="10">Up to 10 Persons</option>
                            </select>
                        </div>
                    </div>

                    <button id="btn-generate-invite" class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition flex items-center justify-center space-x-2 active:scale-98">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                        <span>Generate Invitation Link</span>
                    </button>

                    <!-- Generated Link Result Container -->
                    <div id="invite-result-box" class="hidden p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div class="flex items-center justify-between text-[11px]">
                            <span class="text-emerald-400 font-semibold flex items-center space-x-1">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                <span>Link Generated Successfully</span>
                            </span>
                            <span id="invite-result-role-badge" class="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-indigo-500/20 text-indigo-300">
                                PARTICIPANT
                            </span>
                        </div>
                        <div class="flex space-x-2">
                            <input id="invite-url-input" type="text" readonly
                                class="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none select-all">
                            <button id="btn-copy-invite-url" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center space-x-1">
                                <span id="copy-btn-text">Copy</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Panel 2: Manage Active Invitations -->
                <div id="invite-panel-manage" class="hidden space-y-3">
                    <div id="invitations-list-container" class="space-y-2">
                        <p class="text-slate-500 italic text-center py-4">No invitations created yet.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Load Client Bundle -->
    <script src="/js/webrtc.bundle.js"></script>
    <script>if (typeof WebRTC !== 'undefined') window.NexusRTC = window.NexusRTC || WebRTC;</script>

    <script>
        document.addEventListener('DOMContentLoaded', async () => {
            const config = {
                wsUrl: "{{ $wsUrl }}",
                token: "{{ $token }}",
                media: @json($media),
                self: @json($participant),
                room: @json($room)
            };

            // Switch Tabs
            const tabChat = document.getElementById('tab-btn-chat');
            const tabParticipants = document.getElementById('tab-btn-participants');
            const tabBreakout = document.getElementById('tab-btn-breakout');
            const panelChat = document.getElementById('panel-chat');
            const panelParticipants = document.getElementById('panel-participants');
            const panelBreakout = document.getElementById('panel-breakout');

            function switchTab(activeTab, activePanel) {
                [tabChat, tabParticipants, tabBreakout].forEach(t => {
                    t.className = 'flex-1 py-3 text-slate-400 hover:text-slate-200';
                });
                [panelChat, panelParticipants, panelBreakout].forEach(p => p.classList.add('hidden'));

                activeTab.className = 'flex-1 py-3 border-b-2 border-indigo-500 text-indigo-400 font-bold';
                activePanel.classList.remove('hidden');
            }

            tabChat.onclick = () => switchTab(tabChat, panelChat);
            tabParticipants.onclick = () => switchTab(tabParticipants, panelParticipants);
            tabBreakout.onclick = () => switchTab(tabBreakout, panelBreakout);

            // Instantiate WebRTCClient from bundled SDK
            const ClientClass = (window.WebRTC && window.WebRTC.WebRTCClient) || (window.WebRTC && window.WebRTC.NexusClient) || (window.NexusRTC && window.NexusRTC.NexusClient);
            const client = new ClientClass({
                wsUrl: config.wsUrl,
                token: config.token,
                autoConnect: true
            });
            window.WebRtcClientInstance = client;
            window.NexusClientInstance = client;

            // WebSocket Connection Events
            client.on('connected', () => console.log('[WebRTC] Connected to signaling gateway'));
            
            client.on('joined', (data) => {
                console.log('[WebRTC] Successfully joined room', data);
                updateParticipantsList(client.getParticipants());
                
                // Mount Media SFU Provider (Jitsi Meet iframe)
                const mediaContainer = document.getElementById('jitsi-container');
                document.getElementById('media-placeholder')?.remove();

                client.media.attachJitsi(mediaContainer, {
                    provider: data.media.provider,
                    domain: data.media.domain,
                    room: data.media.room,
                    token: data.media.token || config.media.token,
                    role: client.getSelf()?.role || config.self.role,
                    permissions: client.getEffectivePermissions()
                });
            });

            // Participant Sync
            client.on('participantJoined', (p) => {
                updateParticipantsList(client.getParticipants());
                appendChatMessage({
                    senderName: 'System',
                    content: `${p.name} joined the meeting.`,
                    timestamp: Date.now()
                });
            });

            client.on('participantLeft', ({ participant }) => {
                updateParticipantsList(client.getParticipants());
                if (participant) {
                    appendChatMessage({
                        senderName: 'System',
                        content: `${participant.name} left the meeting.`,
                        timestamp: Date.now()
                    });
                }
            });

            client.on('handRaised', (p) => {
                appendChatMessage({
                    senderName: 'Notification',
                    content: `✋ ${p.name} raised their hand.`,
                    timestamp: Date.now()
                });
            });

            // Chat Sync
            client.on('chatMessage', (msg) => {
                appendChatMessage(msg);
            });

            // Handle Server-Enforced Errors (Permission Denied, etc.)
            client.on('error', (err) => {
                const message = err?.message || 'Action not permitted by session administrator';
                appendChatMessage({
                    senderName: 'Security Warning',
                    content: `⚠️ ${message}`,
                    timestamp: Date.now()
                });
            });

            // Permissions Sync & Dynamic Locks
            function applyPermissionsToUI() {
                const canAudio = client.hasPermission('media:send_audio');
                const canVideo = client.hasPermission('media:send_video');
                const canScreen = client.hasPermission('media:share_screen');
                const canChat = client.hasPermission('chat:send');
                const canRecord = client.hasPermission('session:start_recording');
                const canBreakout = client.hasPermission('breakout:create');
                const canUpdatePermissions = client.hasPermission('session:update_permissions');

                const btnMic = document.getElementById('btn-toggle-mic');
                const btnCam = document.getElementById('btn-toggle-cam');
                const btnScreen = document.getElementById('btn-toggle-screen');
                const chatInput = document.getElementById('chat-input');
                const btnRecord = document.getElementById('btn-toggle-recording');
                const btnBreakout = document.getElementById('btn-create-breakout');
                const hostControls = document.getElementById('host-controls');

                if (btnMic) {
                    btnMic.disabled = !canAudio;
                    btnMic.classList.toggle('opacity-50', !canAudio);
                    btnMic.classList.toggle('cursor-not-allowed', !canAudio);
                    if (!canAudio) {
                        btnMic.title = 'Microphone locked by session administrator';
                        client.media.muteAudio(true);
                    }
                }

                if (btnCam) {
                    btnCam.disabled = !canVideo;
                    btnCam.classList.toggle('opacity-50', !canVideo);
                    btnCam.classList.toggle('cursor-not-allowed', !canVideo);
                    if (!canVideo) {
                        btnCam.title = 'Camera locked by session administrator';
                        client.media.muteVideo(true);
                    }
                }

                if (btnScreen) {
                    btnScreen.disabled = !canScreen;
                    btnScreen.classList.toggle('opacity-50', !canScreen);
                    btnScreen.classList.toggle('cursor-not-allowed', !canScreen);
                    if (!canScreen) {
                        btnScreen.title = 'Screen sharing disabled by session administrator';
                        client.media.stopScreenShare();
                    }
                }

                if (chatInput) {
                    chatInput.disabled = !canChat;
                    if (!canChat) {
                        chatInput.placeholder = 'Chat disabled by session administrator';
                    } else {
                        chatInput.placeholder = 'Type a message...';
                    }
                }

                if (btnRecord) {
                    btnRecord.style.display = canRecord ? 'flex' : 'none';
                }

                if (btnBreakout) {
                    btnBreakout.disabled = !canBreakout;
                }

                if (hostControls) {
                    hostControls.classList.toggle('hidden', !canUpdatePermissions);
                }

                updateParticipantsList(client.getParticipants());
            }

            client.on('joined', () => {
                applyPermissionsToUI();
            });

            client.on('permissionsUpdated', (payload) => {
                console.log('[WebRTC] Permissions updated from server:', payload);
                applyPermissionsToUI();
                appendChatMessage({
                    senderName: 'System Notice',
                    content: 'Your permissions have been updated by the session administrator.',
                    timestamp: Date.now()
                });
            });

            let currentLocks = {};
            client.on('locksChanged', (payload) => {
                currentLocks = payload.locks || {};
                updateLockButtonsUI();
                applyPermissionsToUI();
            });

            function updateLockButtonsUI() {
                const btnMic = document.getElementById('btn-lock-mics');
                const btnCam = document.getElementById('btn-lock-cams');
                const btnScreen = document.getElementById('btn-lock-screen');
                const btnChat = document.getElementById('btn-lock-chat');

                if (btnMic) btnMic.textContent = currentLocks.lockMicrophones ? 'Unlock All Mics' : 'Lock All Mics';
                if (btnCam) btnCam.textContent = currentLocks.lockCameras ? 'Unlock All Cameras' : 'Lock All Cameras';
                if (btnScreen) btnScreen.textContent = currentLocks.lockScreenshare ? 'Unlock Screen' : 'Lock Screen';
                if (btnChat) btnChat.textContent = currentLocks.lockChat ? 'Unlock Chat' : 'Lock Chat';
            }

            document.getElementById('btn-lock-mics')?.addEventListener('click', () => {
                currentLocks.lockMicrophones = !currentLocks.lockMicrophones;
                client.updateRoomPermissions(null, currentLocks);
            });
            document.getElementById('btn-lock-cams')?.addEventListener('click', () => {
                currentLocks.lockCameras = !currentLocks.lockCameras;
                client.updateRoomPermissions(null, currentLocks);
            });
            document.getElementById('btn-lock-screen')?.addEventListener('click', () => {
                currentLocks.lockScreenshare = !currentLocks.lockScreenshare;
                client.updateRoomPermissions(null, currentLocks);
            });
            document.getElementById('btn-lock-chat')?.addEventListener('click', () => {
                currentLocks.lockChat = !currentLocks.lockChat;
                client.updateRoomPermissions(null, currentLocks);
            });

            // Handle Moderation actions directed at self
            client.on('moderated', (payload) => {
                const self = client.getSelf();
                if (payload.targetParticipantId === self?.id) {
                    if (payload.action === 'kick') {
                        alert('You have been removed from the session by the host.');
                        window.location.href = "{{ route('meetings.index') }}";
                    } else if (payload.action === 'mute-audio') {
                        client.media.muteAudio(true);
                        appendChatMessage({
                            senderName: 'System Notice',
                            content: 'Your microphone was muted by a session moderator.',
                            timestamp: Date.now()
                        });
                    } else if (payload.action === 'mute-video') {
                        client.media.muteVideo(true);
                        appendChatMessage({
                            senderName: 'System Notice',
                            content: 'Your camera was disabled by a session moderator.',
                            timestamp: Date.now()
                        });
                    }
                }
            });

            // Recording Sync
            let isRecording = false;
            client.on('recordingStateChanged', (rec) => {
                const recBadge = document.getElementById('recording-badge');
                const recBtnLabel = document.getElementById('rec-btn-label');
                if (rec.status === 'recording') {
                    isRecording = true;
                    recBadge?.classList.remove('hidden');
                    recBadge?.classList.add('flex');
                    if (recBtnLabel) recBtnLabel.textContent = 'Stop Recording';
                } else {
                    isRecording = false;
                    recBadge?.classList.add('hidden');
                    recBadge?.classList.remove('flex');
                    if (recBtnLabel) recBtnLabel.textContent = 'Start Recording';
                }
            });

            // Control Buttons
            document.getElementById('btn-toggle-mic')?.addEventListener('click', () => {
                client.media.toggleAudio();
            });

            document.getElementById('btn-toggle-cam')?.addEventListener('click', () => {
                client.media.toggleVideo();
            });

            document.getElementById('btn-toggle-screen')?.addEventListener('click', () => {
                client.media.toggleScreenShare();
            });

            document.getElementById('btn-raise-hand')?.addEventListener('click', () => {
                client.toggleRaiseHand();
            });

            document.getElementById('btn-toggle-recording')?.addEventListener('click', () => {
                if (isRecording) {
                    client.stopRecording();
                } else {
                    client.startRecording();
                }
            });

            // Chat Send
            document.getElementById('chat-form')?.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = document.getElementById('chat-input');
                const text = input.value.trim();
                if (text) {
                    client.chat.sendMessage(text);
                    input.value = '';
                }
            });

            // Breakout Creation
            document.getElementById('btn-create-breakout')?.addEventListener('click', () => {
                const input = document.getElementById('breakout-name-input');
                const name = input.value.trim();
                if (name) {
                    client.breakout.createBreakout(name);
                    input.value = '';
                }
            });

            client.breakout.on('breakoutCreated', (room) => {
                renderBreakouts(client.breakout.getBreakouts());
            });

            function updateParticipantsList(list) {
                const container = document.getElementById('participants-list');
                const counter = document.getElementById('participants-count');
                if (counter) counter.textContent = list.length;
                if (!container) return;

                const self = client.getSelf();
                const canMuteOthers = client.hasPermission('moderation:mute_others');
                const canKickOthers = client.hasPermission('moderation:kick_participants');

                container.innerHTML = list.map(p => {
                    const isSelf = p.id === self?.id;
                    const isTargetHost = p.role === 'host' || p.id === config.room.hostId;
                    const isTargetModerator = p.role === 'moderator';
                    const callerIsHost = self?.role === 'host' || self?.id === config.room.hostId;

                    let actionsHtml = '';
                    // Host has absolute immunity from moderation.
                    // If target is a moderator, ONLY the room host can moderate them.
                    // Non-privileged participants cannot moderate any participant.
                    if (!isSelf && !isTargetHost && (!isTargetModerator || callerIsHost)) {
                        if (canMuteOthers) {
                            actionsHtml += `<button onclick="window.NexusClientInstance.moderateParticipant('${p.id}', 'mute-audio')" class="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded text-[10px] font-medium transition mr-1">Mute</button>`;
                        }
                        if (canKickOthers) {
                            actionsHtml += `<button onclick="window.NexusClientInstance.moderateParticipant('${p.id}', 'kick')" class="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded text-[10px] font-medium transition">Kick</button>`;
                        }
                    }

                    let roleBadge = '';
                    if (isTargetHost) {
                        roleBadge = '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] uppercase font-bold border border-amber-500/30">Host</span>';
                    } else if (p.role === 'moderator') {
                        roleBadge = '<span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[9px] uppercase font-bold border border-indigo-500/30">Moderator</span>';
                    } else if (p.role === 'viewer') {
                        roleBadge = '<span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[9px] uppercase font-bold border border-blue-500/30">Viewer</span>';
                    } else {
                        roleBadge = '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] uppercase font-bold border border-emerald-500/30">Participant</span>';
                    }

                    return `
                        <div class="p-3 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                            <div>
                                <div class="flex items-center space-x-1.5 mb-1">
                                    <span class="font-semibold text-slate-200 text-xs">${p.name} ${isSelf ? '<span class="text-indigo-400 font-normal">(You)</span>' : ''}</span>
                                    ${roleBadge}
                                </div>
                                <span class="text-[10px] text-slate-400 block">${p.role === 'viewer' ? 'Read-only attendee' : (p.role === 'host' ? 'Meeting Host' : 'Interactive attendee')}</span>
                            </div>
                            <div class="flex items-center space-x-2 text-xs">
                                ${p.isHandRaised ? '<span>✋</span>' : ''}
                                <span class="w-2 h-2 rounded-full ${p.isAudioMuted ? 'bg-rose-500' : 'bg-emerald-500'}" title="${p.isAudioMuted ? 'Muted' : 'Unmuted'}"></span>
                                ${actionsHtml}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            function appendChatMessage(msg) {
                const container = document.getElementById('chat-messages');
                const countElem = document.getElementById('chat-count');
                if (!container) return;

                const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const el = document.createElement('div');
                el.className = 'p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 space-y-1';
                el.innerHTML = `
                    <div class="flex items-center justify-between text-[11px]">
                        <span class="font-semibold ${msg.senderName === 'System' || msg.senderName === 'Notification' ? 'text-indigo-400' : 'text-slate-300'}">${msg.senderName}</span>
                        <span class="text-slate-500 text-[10px]">${time}</span>
                    </div>
                    <p class="text-slate-200 text-xs break-words">${msg.content}</p>
                `;
                container.appendChild(el);
                container.scrollTop = container.scrollHeight;

                if (countElem) {
                    const current = parseInt(countElem.textContent || '0', 10);
                    countElem.textContent = current + 1;
                }
            }

            function renderBreakouts(breakouts) {
                const container = document.getElementById('breakout-list');
                if (!container) return;
                if (breakouts.length === 0) {
                    container.innerHTML = '<p class="text-slate-500 italic">No breakout rooms active.</p>';
                    return;
                }

                container.innerHTML = breakouts.map(b => `
                    <div class="p-3 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                        <div>
                            <span class="font-semibold text-slate-200">${b.name}</span>
                            <span class="text-[10px] text-slate-400 block">${b.participantIds.length} joined</span>
                        </div>
                        <button onclick="window.NexusClientInstance.breakout.joinBreakout('${b.id}')" class="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-xs transition">
                            Join
                        </button>
                    </div>
                `).join('');
            }

            // Invitation Flow & Modal Management
            const inviteModal = document.getElementById('invite-modal');
            const btnOpenInvite = document.getElementById('btn-open-invite-modal');
            const btnQuickInvite = document.getElementById('btn-quick-invite');
            const btnCloseInvite = document.getElementById('btn-close-invite-modal');
            const inviteTabCreate = document.getElementById('invite-tab-create');
            const inviteTabManage = document.getElementById('invite-tab-manage');
            const invitePanelCreate = document.getElementById('invite-panel-create');
            const invitePanelManage = document.getElementById('invite-panel-manage');
            const btnGenerateInvite = document.getElementById('btn-generate-invite');
            const inviteResultBox = document.getElementById('invite-result-box');
            const inviteUrlInput = document.getElementById('invite-url-input');
            const btnCopyInviteUrl = document.getElementById('btn-copy-invite-url');
            const copyBtnText = document.getElementById('copy-btn-text');
            const invitationsCountBadge = document.getElementById('modal-invitations-count');
            const invitationsListContainer = document.getElementById('invitations-list-container');
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

            function openInviteModal() {
                if (inviteModal) {
                    inviteModal.classList.remove('hidden');
                    inviteModal.classList.add('flex');
                    loadInvitations();
                }
            }

            function closeInviteModal() {
                if (inviteModal) {
                    inviteModal.classList.add('hidden');
                    inviteModal.classList.remove('flex');
                }
            }

            btnOpenInvite?.addEventListener('click', openInviteModal);
            btnQuickInvite?.addEventListener('click', openInviteModal);
            btnCloseInvite?.addEventListener('click', closeInviteModal);

            inviteModal?.addEventListener('click', (e) => {
                if (e.target === inviteModal) closeInviteModal();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && inviteModal && !inviteModal.classList.contains('hidden')) {
                    closeInviteModal();
                }
            });

            function switchInviteTab(activeTab, activePanel) {
                [inviteTabCreate, inviteTabManage].forEach(t => {
                    t.className = 'py-3 text-slate-400 hover:text-slate-200 font-semibold';
                });
                [invitePanelCreate, invitePanelManage].forEach(p => p.classList.add('hidden'));

                activeTab.className = 'py-3 border-b-2 border-indigo-500 text-indigo-400 font-semibold mr-6';
                activePanel.classList.remove('hidden');
            }

            inviteTabCreate?.addEventListener('click', () => switchInviteTab(inviteTabCreate, invitePanelCreate));
            inviteTabManage?.addEventListener('click', () => {
                switchInviteTab(inviteTabManage, invitePanelManage);
                loadInvitations();
            });

            btnGenerateInvite?.addEventListener('click', async () => {
                const roleInput = document.querySelector('input[name="invite-role"]:checked');
                const expiryInput = document.getElementById('invite-expiry');
                const maxUsesInput = document.getElementById('invite-max-uses');

                const role = roleInput ? roleInput.value : 'participant';
                const expiresInSeconds = expiryInput && expiryInput.value ? parseInt(expiryInput.value, 10) : null;
                const maxUses = maxUsesInput && maxUsesInput.value ? parseInt(maxUsesInput.value, 10) : null;

                btnGenerateInvite.disabled = true;
                btnGenerateInvite.textContent = 'Generating link...';

                try {
                    const res = await fetch(`/room/${config.room.slug}/invitations`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': csrfToken
                        },
                        body: JSON.stringify({ role, expiresInSeconds, maxUses })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to generate invitation');

                    if (inviteUrlInput) inviteUrlInput.value = data.joinUrl;
                    const roleBadge = document.getElementById('invite-result-role-badge');
                    if (roleBadge) {
                        roleBadge.textContent = (data.role || role).toUpperCase();
                        roleBadge.className = data.role === 'viewer'
                            ? 'px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-blue-500/20 text-blue-300'
                            : 'px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300';
                    }
                    inviteResultBox?.classList.remove('hidden');
                    loadInvitations();
                } catch (err) {
                    alert('Error: ' + err.message);
                } finally {
                    btnGenerateInvite.disabled = false;
                    btnGenerateInvite.innerHTML = '<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg><span>Generate Invitation Link</span>';
                }
            });

            btnCopyInviteUrl?.addEventListener('click', async () => {
                if (inviteUrlInput && inviteUrlInput.value) {
                    try {
                        await navigator.clipboard.writeText(inviteUrlInput.value);
                        if (copyBtnText) copyBtnText.textContent = 'Copied!';
                        btnCopyInviteUrl.classList.add('bg-emerald-600', 'text-white');
                        setTimeout(() => {
                            if (copyBtnText) copyBtnText.textContent = 'Copy';
                            btnCopyInviteUrl.classList.remove('bg-emerald-600', 'text-white');
                        }, 2000);
                    } catch {
                        inviteUrlInput.select();
                        document.execCommand('copy');
                        if (copyBtnText) copyBtnText.textContent = 'Copied!';
                        setTimeout(() => {
                            if (copyBtnText) copyBtnText.textContent = 'Copy';
                        }, 2000);
                    }
                }
            });

            async function loadInvitations() {
                try {
                    const res = await fetch(`/room/${config.room.slug}/invitations`, {
                        headers: {
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': csrfToken
                        }
                    });
                    if (!res.ok) return;
                    const invitations = await res.json();

                    if (invitationsCountBadge) invitationsCountBadge.textContent = invitations.length;
                    if (!invitationsListContainer) return;

                    if (invitations.length === 0) {
                        invitationsListContainer.innerHTML = '<p class="text-slate-500 italic text-center py-4">No invitations created yet.</p>';
                        return;
                    }

                    invitationsListContainer.innerHTML = invitations.map(inv => {
                        const isExpired = inv.status === 'expired' || (inv.expiresAt && Date.now() > inv.expiresAt);
                        const isRevoked = inv.status === 'revoked';
                        const isActive = !isRevoked && !isExpired;

                        let statusBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400">ACTIVE</span>';
                        if (isRevoked) {
                            statusBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400">REVOKED</span>';
                        } else if (isExpired) {
                            statusBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">EXPIRED</span>';
                        }

                        const roleBadge = inv.role === 'viewer'
                            ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300">VIEWER</span>'
                            : '<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300">PARTICIPANT</span>';

                        const usesText = inv.maxUses ? `${inv.usesCount} / ${inv.maxUses} used` : `${inv.usesCount} joined`;
                        const expiryText = inv.expiresAt ? `Expires: ${new Date(inv.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No expiry';

                        return `
                            <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-2">
                                        ${roleBadge}
                                        ${statusBadge}
                                    </div>
                                    <div class="flex items-center space-x-1">
                                        <button onclick="navigator.clipboard.writeText('${inv.joinUrl}'); alert('Invitation link copied!');"
                                            class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition">
                                            Copy Link
                                        </button>
                                        ${isActive ? `
                                            <button onclick="window.revokeInvite('${inv.code}')"
                                                class="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] transition">
                                                Revoke
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                    <span class="truncate max-w-[200px]" title="${inv.joinUrl}">${inv.joinUrl}</span>
                                    <span>${usesText} • ${expiryText}</span>
                                </div>
                            </div>
                        `;
                    }).join('');
                } catch (err) {
                    console.error('Failed to load invitations:', err);
                }
            }

            window.revokeInvite = async (code) => {
                if (!confirm('Are you sure you want to revoke this invitation? Any user attempting to join with it will be rejected.')) return;
                try {
                    const res = await fetch(`/room/${config.room.slug}/invitations/${code}/revoke`, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': csrfToken
                        }
                    });
                    if (!res.ok) throw new Error('Failed to revoke invitation');
                    loadInvitations();
                } catch (err) {
                    alert('Error: ' + err.message);
                }
            };

            window.WebRtcClientInstance = client;
            window.NexusClientInstance = client;
        });
    </script>
</body>
</html>
