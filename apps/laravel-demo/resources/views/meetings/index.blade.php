<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NexusRTC Video Meetings - Laravel Integration Demo</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col justify-center items-center p-6">

    <div class="max-w-xl w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/60 p-8">
        <div class="flex items-center space-x-3 mb-6">
            <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30 text-xl">
                N
            </div>
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-white">NexusRTC Engine</h1>
                <p class="text-xs text-slate-400">Production WebRTC Foundation • Laravel 13 Integration</p>
            </div>
        </div>

        @if($errors->any())
            <div class="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
                {{ $errors->first() }}
            </div>
        @endif

        <!-- Create Meeting Form -->
        <form action="{{ route('meetings.store') }}" method="POST" class="space-y-5">
            @csrf
            <div>
                <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Meeting Title</label>
                <input type="text" name="title" required value="Product Strategy Sync" 
                    class="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">
            </div>

            <div>
                <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Your Name (Host)</label>
                <input type="text" name="hostName" required value="Sarah Connor" 
                    class="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">
            </div>

            <div class="pt-2">
                <span class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Room Capabilities</span>
                <div class="grid grid-cols-2 gap-3">
                    <label class="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                        <input type="checkbox" name="recordingEnabled" value="1" checked class="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500">
                        <span>Cloud Recording</span>
                    </label>
                    <label class="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                        <input type="checkbox" name="chatEnabled" value="1" checked class="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500">
                        <span>Real-Time Chat</span>
                    </label>
                    <label class="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                        <input type="checkbox" name="breakoutRoomsEnabled" value="1" checked class="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500">
                        <span>Breakout Rooms</span>
                    </label>
                    <label class="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                        <input type="checkbox" checked disabled class="rounded border-slate-700 bg-slate-900 text-indigo-600 opacity-60">
                        <span class="text-slate-400">Screen Sharing</span>
                    </label>
                </div>
            </div>

            <button type="submit" 
                class="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-600/30 hover:opacity-95 transition active:scale-[0.99] flex items-center justify-center space-x-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                <span>Launch Meeting Session</span>
            </button>
        </form>

        <div class="mt-8 pt-6 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
            <span>Core: Node.js/TS Engine</span>
            <span>Adapter: SQLite & Jitsi SFU</span>
            <span>Consumer: Laravel 13</span>
        </div>
    </div>

</body>
</html>
