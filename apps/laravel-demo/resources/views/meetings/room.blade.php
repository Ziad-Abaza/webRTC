<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $room->title }} - NexusRTC Room</title>
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

        <div class="flex items-center space-x-4">
            <div id="recording-badge" class="hidden items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <span>REC</span>
            </div>

            <div class="flex items-center space-x-2 text-xs">
                <span class="text-slate-400">Signed in as:</span>
                <span class="font-semibold text-indigo-400">{{ $participant['name'] }}</span>
                <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono uppercase text-[10px]">{{ $participant['role'] }}</span>
            </div>

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
                            Welcome to <strong>{{ $room->title }}</strong>. Chat is encrypted and synced via Nexus signaling.
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
                <div id="panel-participants" class="hidden flex-1 overflow-y-auto p-4 space-y-2">
                    <div id="participants-list" class="space-y-2">
                        <!-- Populated by JS SDK -->
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

    <!-- Load Client Bundle -->
    <script src="/js/nexusrtc.bundle.js"></script>

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

            // Instantiate NexusClient from bundled SDK
            const client = new NexusRTC.NexusClient({
                wsUrl: config.wsUrl,
                token: config.token,
                autoConnect: true
            });

            // WebSocket Connection Events
            client.on('connected', () => console.log('[NexusRTC] Connected to signaling gateway'));
            
            client.on('joined', (data) => {
                console.log('[NexusRTC] Successfully joined room', data);
                updateParticipantsList(client.getParticipants());
                
                // Mount Media SFU Provider (Jitsi Meet iframe)
                const mediaContainer = document.getElementById('jitsi-container');
                document.getElementById('media-placeholder')?.remove();

                client.media.attachJitsi(mediaContainer, {
                    provider: data.media.provider,
                    domain: data.media.domain,
                    room: data.media.room,
                    token: data.media.token
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

                container.innerHTML = list.map(p => `
                    <div class="p-3 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                        <div>
                            <span class="font-semibold text-slate-200">${p.name}</span>
                            <span class="text-[10px] text-slate-400 block">${p.role}</span>
                        </div>
                        <div class="flex items-center space-x-2 text-xs">
                            ${p.isHandRaised ? '<span>✋</span>' : ''}
                            <span class="w-2 h-2 rounded-full ${p.isAudioMuted ? 'bg-rose-500' : 'bg-emerald-500'}"></span>
                        </div>
                    </div>
                `).join('');
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

            window.NexusClientInstance = client;
        });
    </script>
</body>
</html>
