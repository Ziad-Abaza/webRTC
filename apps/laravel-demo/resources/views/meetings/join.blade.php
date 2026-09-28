<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>
        @if($status === 'valid' && $room)
            Join {{ $room->title }} - WebRTC Invitation
        @else
            Meeting Invitation - WebRTC
        @endif
    </title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-center items-center p-6 selection:bg-indigo-500 selection:text-white">

    <div class="max-w-lg w-full bg-slate-900/90 rounded-2xl shadow-2xl border border-slate-800 p-8 backdrop-blur-sm">
        
        <!-- Header Branding -->
        <div class="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/80">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30 text-xl">
                    W
                </div>
                <div>
                    <h1 class="text-lg font-bold tracking-tight text-white leading-tight">WebRTC</h1>
                    <p class="text-[11px] text-slate-400">Secure Session Invitation</p>
                </div>
            </div>
            @if($status === 'valid' && $room)
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                    Room Active
                </span>
            @endif
        </div>

        @if($errors->any())
            <div class="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {{ $errors->first() }}
            </div>
        @endif

        @if($status !== 'valid')
            <!-- Error State Card -->
            <div class="text-center py-4 space-y-4">
                <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center 
                    @if($status === 'revoked') bg-rose-500/10 text-rose-400 border border-rose-500/20
                    @elseif($status === 'expired' || $status === 'limit_reached') bg-amber-500/10 text-amber-400 border border-amber-500/20
                    @else bg-slate-800 text-slate-400 border border-slate-700 @endif">
                    @if($status === 'revoked')
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                    @elseif($status === 'expired' || $status === 'limit_reached')
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    @else
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    @endif
                </div>

                <div class="space-y-1">
                    <h2 class="text-lg font-bold text-white">
                        @if($status === 'revoked')
                            Invitation Revoked
                        @elseif($status === 'expired')
                            Invitation Expired
                        @elseif($status === 'limit_reached')
                            Usage Limit Reached
                        @elseif($status === 'room_closed')
                            Meeting Ended
                        @else
                            Invalid Invitation Link
                        @endif
                    </h2>
                    <p class="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        {{ $message ?? 'This invitation cannot be used to join the session. Contact the host to request a new link.' }}
                    </p>
                </div>

                <div class="pt-4">
                    <a href="{{ route('meetings.index') }}" 
                        class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition">
                        <span>Return to Home</span>
                    </a>
                </div>
            </div>

        @else
            <!-- Valid Invitation Flow -->
            <div class="space-y-6">
                <!-- Room Overview -->
                <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Session Details</span>
                    <h2 class="text-xl font-bold text-white tracking-tight">{{ $room->title }}</h2>
                    <p class="text-xs text-slate-400 font-mono">Room code: <span class="text-slate-300 font-semibold">{{ $room->slug }}</span></p>
                </div>

                <!-- Access / Role Clarity Badge -->
                <div class="p-4 rounded-xl border @if($invitation['role'] === 'viewer') bg-blue-500/10 border-blue-500/30 @else bg-indigo-500/10 border-indigo-500/30 @endif space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold uppercase tracking-wider text-slate-300">Your Assigned Access</span>
                        @if($invitation['role'] === 'viewer')
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase">
                                Viewer (Read-Only)
                            </span>
                        @else
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                                Participant
                            </span>
                        @endif
                    </div>

                    <p class="text-xs @if($invitation['role'] === 'viewer') text-blue-200/90 @else text-indigo-200/90 @endif leading-relaxed">
                        @if($invitation['role'] === 'viewer')
                            You are joining as an attendee. You can watch the live video and listen to the presentation. Microphones and cameras are disabled by default.
                        @else
                            You are joining as an active participant. You will be able to speak, enable your camera, participate in group chat, and interact with the session.
                        @endif
                    </p>

                    <!-- Feature Badges -->
                    <div class="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                        @if($invitation['role'] === 'viewer')
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Live Video Stream</span>
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Audio Playback</span>
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Raise Hand</span>
                        @else
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Microphone</span>
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Camera</span>
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Chat</span>
                            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Screen Sharing</span>
                        @endif
                    </div>
                </div>

                <!-- Join Form -->
                <form action="{{ route('meetings.join.process', ['code' => $invitation['code']]) }}" method="POST" class="space-y-4">
                    @csrf

                    <div>
                        <label for="participant-name" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Your Display Name
                        </label>
                        <input type="text" id="participant-name" name="name" required autofocus placeholder="e.g. Alex Morgan"
                            class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm">
                        <p class="text-[11px] text-slate-500 mt-1.5">This name will be visible to other participants in the meeting room.</p>
                    </div>

                    @if(!empty($invitation['expiresAt']))
                        <div class="text-[11px] text-slate-400 flex items-center space-x-1.5">
                            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span>This invitation link expires on {{ date('M j, Y \a\t g:i A', $invitation['expiresAt'] / 1000) }}.</span>
                        </div>
                    @endif

                    <button type="submit"
                        class="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition active:scale-[0.99] flex items-center justify-center space-x-2">
                        <span>Enter Meeting Room</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </button>
                </form>

                <div class="pt-2 text-center">
                    <a href="{{ route('meetings.index') }}" class="text-xs text-slate-500 hover:text-slate-400 transition">
                        Cancel and return to home
                    </a>
                </div>
            </div>
        @endif

        <div class="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Authoritative Engine Security</span>
            <span>WebRTC Monorepo</span>
        </div>
    </div>

</body>
</html>
