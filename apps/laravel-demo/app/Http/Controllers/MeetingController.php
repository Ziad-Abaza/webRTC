<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use NexusRTC\Client\Laravel\Facades\NexusRTC;
use NexusRTC\Client\Exceptions\NexusRtcException;

class MeetingController extends Controller
{
    /**
     * Display a dashboard listing or create meeting form.
     */
    public function index()
    {
        return view('meetings.index');
    }

    /**
     * Create a new video meeting room via NexusRTC backend.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:120',
            'hostName' => 'required|string|max:60',
            'recordingEnabled' => 'nullable|boolean',
            'chatEnabled' => 'nullable|boolean',
            'breakoutRoomsEnabled' => 'nullable|boolean',
            'allowParticipantVideo' => 'nullable|boolean',
            'allowParticipantAudio' => 'nullable|boolean',
            'allowParticipantScreenshare' => 'nullable|boolean',
            'allowParticipantChat' => 'nullable|boolean',
        ]);

        try {
            // Build custom granular permissions for participant role
            $participantPermissions = [
                'interaction:raise_hand',
                'breakout:join'
            ];
            if ($request->boolean('allowParticipantAudio', true)) {
                $participantPermissions[] = 'media:send_audio';
            }
            if ($request->boolean('allowParticipantVideo', true)) {
                $participantPermissions[] = 'media:send_video';
            }
            if ($request->boolean('allowParticipantScreenshare', false)) {
                $participantPermissions[] = 'media:share_screen';
            }
            if ($request->boolean('allowParticipantChat', true)) {
                $participantPermissions[] = 'chat:send';
                $participantPermissions[] = 'chat:send_private';
            }

            $room = NexusRTC::createRoom([
                'title' => $validated['title'],
                'hostId' => 'host-' . substr(md5(uniqid()), 0, 8),
                'features' => [
                    'recordingEnabled' => $request->boolean('recordingEnabled', true),
                    'chatEnabled' => $request->boolean('chatEnabled', true),
                    'breakoutRoomsEnabled' => $request->boolean('breakoutRoomsEnabled', true),
                    'screenShareEnabled' => true,
                    'raiseHandEnabled' => true,
                ],
                'permissions' => [
                    'roles' => [
                        'participant' => $participantPermissions
                    ]
                ]
            ]);

            // Store host credentials securely in the user's server-side session
            $request->session()->put("room_host_{$room->slug}", [
                'hostId' => $room->hostId,
                'hostKey' => $room->hostKey,
                'hostName' => $validated['hostName'],
            ]);
            $request->session()->save();

            return redirect()->route('meetings.show', [
                'slug' => $room->slug,
                'name' => $validated['hostName']
            ]);
        } catch (NexusRtcException $e) {
            return back()->withErrors(['error' => 'Failed to initialize meeting: ' . $e->getMessage()]);
        }
    }

    /**
     * Join and render the meeting room.
     */
    public function show(Request $request, string $slug)
    {
        $name = $request->query('name', 'Guest Participant');

        $room = NexusRTC::getRoom($slug);
        if (!$room) {
            abort(404, 'Meeting room not found or expired.');
        }

        // Authoritatively check session to determine if the caller is the verified room host
        $hostSession = $request->session()->get("room_host_{$slug}");
        $isHost = is_array($hostSession) && !empty($hostSession['hostKey']);

        // Build token request:
        // Host role is ONLY requested if backed by the verified hostKey from session.
        // Invited regular guests NEVER receive host privileges, even if they manipulate query parameters or payload.
        $tokenPayload = [
            'name' => $name,
        ];

        if ($isHost) {
            $tokenPayload['role'] = 'host';
            $tokenPayload['participantId'] = $hostSession['hostId'];
            $tokenPayload['hostKey'] = $hostSession['hostKey'];
        } else {
            $tokenPayload['role'] = 'participant';
        }

        // Generate authoritative join token from NexusRTC engine
        $tokenData = NexusRTC::generateJoinToken($slug, $tokenPayload);

        return view('meetings.room', [
            'room' => $room,
            'token' => $tokenData['token'],
            'media' => $tokenData['media'],
            'participant' => $tokenData['participant'],
            'wsUrl' => config('nexusrtc.ws_url', 'ws://127.0.0.1:4000/ws'),
        ]);
    }
}
