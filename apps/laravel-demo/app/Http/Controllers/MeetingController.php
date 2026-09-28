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

            // Build granular permissions for host role (allowing host capabilities to be authoritatively restricted)
            $hostPermissions = [
                'media:send_audio',
                'media:send_video',
                'media:share_screen',
                'chat:send',
                'chat:send_private',
                'interaction:raise_hand',
                'moderation:mute_others',
                'moderation:kick_participants',
                'session:update_permissions',
                'moderation:manage_participants'
            ];
            if ($request->boolean('allowHostRecording', true) && $request->boolean('recordingEnabled', true)) {
                $hostPermissions[] = 'session:start_recording';
                $hostPermissions[] = 'session:stop_recording';
            }
            if ($request->boolean('allowHostBreakout', true) && $request->boolean('breakoutRoomsEnabled', true)) {
                $hostPermissions[] = 'breakout:create';
                $hostPermissions[] = 'breakout:join';
                $hostPermissions[] = 'breakout:broadcast';
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
                        'participant' => $participantPermissions,
                        'host' => $hostPermissions
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
     * Generate an authoritative invitation for this room (Host Only).
     */
    public function createInvitation(Request $request, string $slug)
    {
        $hostSession = $request->session()->get("room_host_{$slug}");
        if (!is_array($hostSession) || empty($hostSession['hostKey'])) {
            return response()->json(['error' => 'Unauthorized: Only room host can generate invitations'], 403);
        }

        $validated = $request->validate([
            'role' => 'nullable|string|in:participant,viewer',
            'expiresInSeconds' => 'nullable|integer|min:60',
            'maxUses' => 'nullable|integer|min:1',
        ]);

        try {
            $invitation = NexusRTC::createInvitation($slug, [
                'role' => $validated['role'] ?? 'participant',
                'expiresInSeconds' => !empty($validated['expiresInSeconds']) ? (int) $validated['expiresInSeconds'] : null,
                'maxUses' => !empty($validated['maxUses']) ? (int) $validated['maxUses'] : null,
            ]);

            $invitation['joinUrl'] = route('meetings.join', ['code' => $invitation['code']]);

            return response()->json($invitation, 201);
        } catch (NexusRtcException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * List all invitations for this room (Host Only).
     */
    public function listInvitations(Request $request, string $slug)
    {
        $hostSession = $request->session()->get("room_host_{$slug}");
        if (!is_array($hostSession) || empty($hostSession['hostKey'])) {
            return response()->json(['error' => 'Unauthorized: Only room host can list invitations'], 403);
        }

        try {
            $invitations = NexusRTC::listInvitations($slug);
            foreach ($invitations as &$inv) {
                $inv['joinUrl'] = route('meetings.join', ['code' => $inv['code']]);
            }
            return response()->json($invitations);
        } catch (NexusRtcException $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Revoke an invitation for this room (Host Only).
     */
    public function revokeInvitation(Request $request, string $slug, string $code)
    {
        $hostSession = $request->session()->get("room_host_{$slug}");
        if (!is_array($hostSession) || empty($hostSession['hostKey'])) {
            return response()->json(['error' => 'Unauthorized: Only room host can revoke invitations'], 403);
        }

        try {
            $result = NexusRTC::revokeInvitation($code);
            return response()->json($result);
        } catch (NexusRtcException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Display the invitation join landing page for an invited guest.
     */
    public function showJoin(Request $request, string $code)
    {
        try {
            $invitation = NexusRTC::getInvitation($code);
        } catch (NexusRtcException $e) {
            return view('meetings.join', [
                'status' => 'invalid',
                'message' => 'This invitation link could not be verified or is invalid.',
                'invitation' => null,
                'room' => null,
            ]);
        }

        if (!$invitation) {
            return view('meetings.join', [
                'status' => 'invalid',
                'message' => 'This invitation link is invalid or no longer exists.',
                'invitation' => null,
                'room' => null,
            ]);
        }

        if ($invitation['status'] === 'revoked') {
            return view('meetings.join', [
                'status' => 'revoked',
                'message' => 'This invitation has been revoked by the meeting host.',
                'invitation' => $invitation,
                'room' => null,
            ]);
        }

        $nowMs = round(microtime(true) * 1000);
        if ($invitation['status'] === 'expired' || (!empty($invitation['expiresAt']) && $nowMs > $invitation['expiresAt'])) {
            return view('meetings.join', [
                'status' => 'expired',
                'message' => 'This invitation link has expired.',
                'invitation' => $invitation,
                'room' => null,
            ]);
        }

        if (!empty($invitation['maxUses']) && $invitation['usesCount'] >= $invitation['maxUses']) {
            return view('meetings.join', [
                'status' => 'limit_reached',
                'message' => 'This invitation link has reached its maximum allowed uses.',
                'invitation' => $invitation,
                'room' => null,
            ]);
        }

        $room = NexusRTC::getRoom($invitation['roomSlug']);
        if (!$room || $room->status !== 'active') {
            return view('meetings.join', [
                'status' => 'room_closed',
                'message' => 'This meeting has ended or is currently inactive.',
                'invitation' => $invitation,
                'room' => $room,
            ]);
        }

        return view('meetings.join', [
            'status' => 'valid',
            'message' => null,
            'invitation' => $invitation,
            'room' => $room,
        ]);
    }

    /**
     * Process invited guest join request.
     */
    public function processJoin(Request $request, string $code)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:60',
        ]);
        $name = trim(strip_tags((string) $validated['name'])) ?: 'Guest Participant';

        try {
            $invitation = NexusRTC::getInvitation($code);
            if (!$invitation || empty($invitation['isValid'])) {
                $errorMsg = 'This invitation is invalid, expired, or has reached its usage limit.';
                if ($invitation && $invitation['status'] === 'revoked') {
                    $errorMsg = 'This invitation has been revoked by the meeting host.';
                }
                return back()->withErrors(['error' => $errorMsg]);
            }

            // Generate authoritative join token from NexusRTC engine bound to this invitation
            $tokenData = NexusRTC::generateJoinToken($invitation['roomSlug'], [
                'name' => $name,
                'inviteCode' => $code,
            ]);

            // Save guest session securely
            $request->session()->put("room_guest_{$invitation['roomSlug']}", [
                'name' => $tokenData['participant']['name'],
                'role' => $tokenData['participant']['role'],
                'token' => $tokenData['token'],
                'media' => $tokenData['media'],
                'participant' => $tokenData['participant'],
                'joinedViaInvite' => $code,
            ]);
            $request->session()->save();

            return redirect()->route('meetings.show', [
                'slug' => $invitation['roomSlug'],
            ]);
        } catch (NexusRtcException $e) {
            return back()->withErrors(['error' => 'Unable to join meeting: ' . $e->getMessage()]);
        }
    }

    /**
     * Join and render the meeting room.
     */
    public function show(Request $request, string $slug)
    {
        $rawName = $request->query('name', 'Guest Participant');
        $name = trim(strip_tags((string) $rawName)) ?: 'Guest Participant';
        if (strlen($name) > 60) {
            $name = substr($name, 0, 60);
        }

        $room = NexusRTC::getRoom($slug);
        if (!$room) {
            abort(404, 'Meeting room not found or expired.');
        }

        // Authoritatively check session to determine if the caller is the verified room host.
        // If the caller explicitly joins as a guest, or specifies a guest participant name different
        // from the session creator's hostName, host credentials MUST NOT be used.
        $hostSession = $request->session()->get("room_host_{$slug}");
        $guestSession = $request->session()->get("room_guest_{$slug}");

        $isGuestQuery = $request->boolean('guest') 
            || $request->query('role') === 'participant' 
            || ($request->has('name') && is_array($hostSession) && !empty($hostSession['hostName']) && $name !== $hostSession['hostName']);

        $isHost = !$isGuestQuery && is_array($hostSession) && !empty($hostSession['hostKey']);

        if (!$isHost && is_array($guestSession) && !empty($guestSession['token'])) {
            // Use verified guest session established via invitation join flow
            $tokenData = [
                'token' => $guestSession['token'],
                'media' => $guestSession['media'],
                'participant' => $guestSession['participant'],
            ];
        } else {
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
        }

        return view('meetings.room', [
            'room' => $room,
            'token' => $tokenData['token'],
            'media' => $tokenData['media'],
            'participant' => $tokenData['participant'],
            'wsUrl' => config('nexusrtc.ws_url', 'ws://127.0.0.1:4000/ws'),
            'isHost' => $isHost,
        ]);
    }
}
