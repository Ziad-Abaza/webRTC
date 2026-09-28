<?php

namespace Tests\Feature;

use Tests\TestCase;

class NexusRtcIntegrationTest extends TestCase
{
    /**
     * Test full meeting lifecycle: host creation with session credentials vs invited participant without host credentials.
     */
    public function test_full_meeting_lifecycle_via_nexusrtc(): void
    {
        // 1. Visit index page
        $response = $this->get('/');
        $response->assertStatus(200);
        $response->assertSee('WebRTC Engine');
        $response->assertSee('Participant Default Permissions');

        // 2. Submit meeting creation with granular participant permission controls
        $storeResponse = $this->post('/meetings', [
            'title' => 'Executive Sprint Review',
            'hostName' => 'Sarah Connor',
            'recordingEnabled' => 1,
            'chatEnabled' => 1,
            'breakoutRoomsEnabled' => 1,
            'allowParticipantAudio' => 1,
            'allowParticipantVideo' => 1,
            'allowParticipantScreenshare' => 0, // screenshare restricted for participants
            'allowParticipantChat' => 1,
        ]);

        $storeResponse->assertStatus(302);
        $redirectUrl = $storeResponse->headers->get('Location');
        $this->assertNotNull($redirectUrl);
        $this->assertStringContainsString('/room/', $redirectUrl);

        // 3. Follow redirect as Host (session has verified hostKey)
        $roomResponse = $this->get($redirectUrl);
        $roomResponse->assertStatus(200);
        $roomResponse->assertSee('Executive Sprint Review');
        $roomResponse->assertSee('Sarah Connor');
        $roomResponse->assertSee('host');
        $roomResponse->assertSee('btn-toggle-recording');
        $roomResponse->assertSee('Launch Breakout Room');
        $roomResponse->assertSee('webrtc.bundle.js');
    }

    /**
     * Test participant joining as guest without host credentials.
     */
    public function test_participant_join_flow(): void
    {
        // Create meeting directly via NexusRTC facade
        $room = \NexusRTC\Client\Laravel\Facades\NexusRTC::createRoom([
            'title' => 'All Hands Townhall',
            'hostId' => 'test-host-id',
            'features' => [
                'recordingEnabled' => true,
                'chatEnabled' => true,
            ]
        ]);

        $this->assertNotEmpty($room->id);
        $this->assertNotEmpty($room->slug);

        // Join as guest participant
        $response = $this->get("/room/{$room->slug}?name=John+Doe");
        $response->assertStatus(200);
        $response->assertSee('All Hands Townhall');
        $response->assertSee('John Doe');
        $response->assertSee('participant');
    }

    /**
     * Test authorization enforcement: Regular invited participant attempting to claim host role
     * via URL manipulation (?role=host) must be authoritatively downgraded to participant.
     */
    public function test_invited_participant_cannot_obtain_host_privileges(): void
    {
        // Session 1: Real Host creates the room
        $createRes = $this->post('/meetings', [
            'title' => 'Confidential Board Meeting',
            'hostName' => 'Board Chairman',
        ]);
        $createRes->assertStatus(302);
        $redirectUrl = $createRes->headers->get('Location');
        preg_match('#/room/([a-zA-Z0-9_-]+)#', $redirectUrl, $matches);
        $slug = $matches[1];

        // Session 2: A separate unauthenticated/guest session attempts to join and claim ?role=host
        session()->flush(); // Clear host session to simulate unauthenticated guest visitor
        $exploitResponse = $this->get("/room/{$slug}?name=Attacker+Guest&role=host");

        $exploitResponse->assertStatus(200);
        $exploitResponse->assertSee('Attacker Guest');
        // Authoritatively enforced: role MUST be participant!
        $exploitResponse->assertSee('participant');
        // Host-only controls must NOT be rendered in the DOM
        $exploitResponse->assertDontSee('<button id="btn-toggle-recording"', false);
        $exploitResponse->assertDontSee('<button id="btn-create-breakout"', false);
        $exploitResponse->assertDontSee('Create Breakout Room');

        // Master hostKey MUST NEVER be leaked into guest DOM or JSON state
        $exploitResponse->assertDontSee('"hostKey"');
    }

    /**
     * Test two genuinely different sessions (Host vs Regular Invited Participant),
     * verifying that host can perform host actions while regular participant is rejected
     * server-side on REST and WebSocket tampering attempts.
     */
    public function test_two_distinct_sessions_host_and_guest_with_authoritative_server_rejection(): void
    {
        // 1. Session 1: Real Host creates a room with strict participant permissions
        $createRes = $this->post('/meetings', [
            'title' => 'Quarterly Strategic Alignment',
            'hostName' => 'Alice Host',
            'recordingEnabled' => 1,
            'breakoutRoomsEnabled' => 1,
            'allowParticipantAudio' => 1,
            'allowParticipantVideo' => 1,
            'allowParticipantScreenshare' => 0,
            'allowParticipantChat' => 1,
        ]);
        $createRes->assertStatus(302);
        $redirectUrl = $createRes->headers->get('Location');
        preg_match('#/room/([a-zA-Z0-9_-]+)#', $redirectUrl, $matches);
        $slug = $matches[1];

        // Retrieve Host Session view data and token
        $hostRoomRes = $this->get($redirectUrl);
        $hostRoomRes->assertStatus(200);
        $hostViewData = $hostRoomRes->original->getData();
        $hostToken = $hostViewData['token'];
        $hostParticipant = $hostViewData['participant'];
        $room = $hostViewData['room'];

        $this->assertEquals('host', $hostParticipant['role']);
        $this->assertNotEmpty($hostToken);

        // 2. Session 2: Regular invited participant joins from a different session
        session()->flush(); // Clear host session
        $guestRoomRes = $this->get("/room/{$slug}?name=Bob+Guest");
        $guestRoomRes->assertStatus(200);
        $guestViewData = $guestRoomRes->original->getData();
        $guestToken = $guestViewData['token'];
        $guestParticipant = $guestViewData['participant'];

        $this->assertEquals('participant', $guestParticipant['role']);
        $this->assertNotEquals($hostParticipant['id'], $guestParticipant['id']);
        $this->assertNotEmpty($guestToken);

        // 3. Direct REST Attack: Regular participant attempts host-only REST endpoints
        $baseUrl = config('webrtc.base_url', config('nexusrtc.base_url', 'http://127.0.0.1:4000'));

        // Attack A: Guest attempts to update room permissions via REST
        $permAttack = \Illuminate\Support\Facades\Http::withToken($guestToken)
            ->put("{$baseUrl}/api/v1/rooms/{$slug}/permissions", [
                'locks' => ['lockMicrophones' => true]
            ]);
        $this->assertEquals(403, $permAttack->status(), 'Guest must receive 403 Forbidden when attempting to update permissions');

        // Attack B: Guest attempts to start recording via REST
        $recAttack = \Illuminate\Support\Facades\Http::withToken($guestToken)
            ->post("{$baseUrl}/api/v1/rooms/{$room->id}/recordings/start", []);
        $this->assertEquals(403, $recAttack->status(), 'Guest must receive 403 Forbidden when attempting to start recording');

        // Attack C: Guest attempts to create breakout rooms via REST
        $breakoutAttack = \Illuminate\Support\Facades\Http::withToken($guestToken)
            ->post("{$baseUrl}/api/v1/rooms/{$room->id}/breakouts", [
                'name' => 'Unauthorized Breakout Room'
            ]);
        $this->assertEquals(403, $breakoutAttack->status(), 'Guest must receive 403 Forbidden when attempting to create breakout rooms');

        // Attack D: Guest attempts to start live broadcast via REST
        $broadcastAttack = \Illuminate\Support\Facades\Http::withToken($guestToken)
            ->post("{$baseUrl}/api/v1/rooms/{$room->id}/broadcast/start", [
                'streamUrl' => 'rtmp://live.example.com',
                'streamKey' => 'secret123'
            ]);
        $this->assertEquals(403, $broadcastAttack->status(), 'Guest must receive 403 Forbidden when attempting to start broadcast');

        // 4. Token Tampering Attack: Altering token payload/signature
        $tamperedToken = substr($guestToken, 0, -6) . 'tamper';
        $tamperRes = \Illuminate\Support\Facades\Http::withToken($tamperedToken)
            ->put("{$baseUrl}/api/v1/rooms/{$slug}/permissions", [
                'locks' => ['lockMicrophones' => true]
            ]);
        $this->assertEquals(401, $tamperRes->status(), 'Tampered token must be rejected with 401 Unauthorized');

        // 5. Cross-room IDOR Attack: Guest attempts to access another room's chat
        $crossRoomAttack = \Illuminate\Support\Facades\Http::withToken($guestToken)
            ->get("{$baseUrl}/api/v1/rooms/non-existent-or-other-room-id/chat");
        $this->assertEquals(403, $crossRoomAttack->status(), 'Cross-room access must be blocked with 403 Forbidden');

        // 6. Legitimate Host Execution: Host CAN execute host-authorized operations
        $hostPermAction = \Illuminate\Support\Facades\Http::withToken($hostToken)
            ->put("{$baseUrl}/api/v1/rooms/{$slug}/permissions", [
                'locks' => ['lockMicrophones' => false]
            ]);
        $this->assertEquals(200, $hostPermAction->status(), 'Host must be authorized to update room permissions');
    }

    /**
     * Test adversarial attacks: Custom role escalation, identity hijacking, role mutation tampering,
     * and banned/evicted participant token rejection.
     */
    public function test_adversarial_guest_privilege_escalation_and_eviction(): void
    {
        $baseUrl = config('webrtc.base_url', config('nexusrtc.base_url', 'http://127.0.0.1:4000'));

        // 1. Host creates a room
        $createRes = $this->post('/meetings', [
            'title' => 'Red-Team Target Room',
            'hostName' => 'Alice Host',
        ]);
        $createRes->assertStatus(302);
        $redirectUrl = $createRes->headers->get('Location');
        preg_match('#/room/([a-zA-Z0-9_-]+)#', $redirectUrl, $matches);
        $slug = $matches[1];

        $hostRoomRes = $this->get($redirectUrl);
        $hostRoomRes->assertStatus(200);
        $hostData = $hostRoomRes->original->getData();
        $hostToken = $hostData['token'];
        $hostParticipant = $hostData['participant'];
        $room = $hostData['room'];

        // 2. Untrusted guest attempts custom role escalation (?role=co-host)
        session()->flush();
        $guestRes = $this->get("/room/{$slug}?name=Eve+Attacker&role=co-host");
        $guestRes->assertStatus(200);
        $guestData = $guestRes->original->getData();
        $guestParticipant = $guestData['participant'];
        $guestToken = $guestData['token'];

        $this->assertEquals('participant', $guestParticipant['role'], 'Custom privileged role must be demoted to participant');
        $this->assertNotContains('moderation:kick_participants', $guestParticipant['permissions']);

        // 3. Untrusted guest attempts to hijack Host's ID via token endpoint
        $apiKey = config('webrtc.api_key', config('nexusrtc.api_key', 'webrtc-master-api-key'));
        $hijackRes = \Illuminate\Support\Facades\Http::withHeaders(['X-API-Key' => $apiKey])
            ->post("{$baseUrl}/api/v1/rooms/{$slug}/token", [
                'name' => 'Host Impersonator',
                'participantId' => $hostParticipant['id'],
                'role' => 'host',
            ]);
        $this->assertEquals(200, $hijackRes->status());
        $hijackData = $hijackRes->json();
        $this->assertEquals('participant', $hijackData['participant']['role'], 'Host role attempt must be demoted to participant');
        $this->assertNotEquals($hostParticipant['id'], $hijackData['participant']['id'], 'Host ID must not be hijacked by untrusted caller');

        // 4. Guest attempts to mutate role definitions or participant overrides
        $tamperRolesRes = \Illuminate\Support\Facades\Http::withToken($guestToken)
            ->put("{$baseUrl}/api/v1/rooms/{$slug}/permissions", [
                'roles' => [
                    'participant' => ['moderation:kick_participants', 'moderation:mute_others']
                ]
            ]);
        $this->assertEquals(403, $tamperRolesRes->status(), 'Non-host participant must not mutate role definitions');

        // 5. Host evicts the attacker by adding their ID to bannedParticipantIds
        $banRes = \Illuminate\Support\Facades\Http::withToken($hostToken)
            ->put("{$baseUrl}/api/v1/rooms/{$slug}/permissions", [
                'bannedParticipantIds' => [$guestParticipant['id']]
            ]);
        $this->assertEquals(200, $banRes->status(), 'Host can ban participant');

        // 6. Evicted guest token must now be rejected with 403 Forbidden
        $evictedReqRes = \Illuminate\Support\Facades\Http::withToken($guestToken)
            ->put("{$baseUrl}/api/v1/rooms/{$slug}/permissions", [
                'locks' => ['lockMicrophones' => true]
            ]);
        $this->assertEquals(403, $evictedReqRes->status(), 'Evicted participant token must be rejected');

        // 7. Evicted guest cannot generate a new token using their evicted participantId
        $rejoinTokenRes = \Illuminate\Support\Facades\Http::withHeaders(['X-API-Key' => $apiKey])
            ->post("{$baseUrl}/api/v1/rooms/{$slug}/token", [
                'name' => 'Eve Attacker',
                'participantId' => $guestParticipant['id']
            ]);
        $this->assertEquals(400, $rejoinTokenRes->status(), 'Evicted participant cannot request a join token');
    }

    /**
     * Test host can create, list, and revoke invitations via room session.
     */
    public function test_host_can_create_and_manage_invitations(): void
    {
        // 1. Host creates room
        $this->post('/meetings', [
            'title' => 'Design Sprint Review',
            'hostName' => 'Sarah Connor',
        ]);
        $roomHost = session()->all();
        $slug = null;
        foreach ($roomHost as $key => $val) {
            if (str_starts_with($key, 'room_host_')) {
                $slug = substr($key, strlen('room_host_'));
                break;
            }
        }
        $this->assertNotNull($slug);

        // 2. Host creates participant invitation
        $createRes = $this->postJson("/room/{$slug}/invitations", [
            'role' => 'participant',
            'expiresInSeconds' => 3600,
            'maxUses' => 5,
        ]);
        $createRes->assertStatus(201);
        $invData = $createRes->json();
        $this->assertNotEmpty($invData['code']);
        $this->assertEquals('participant', $invData['role']);
        $this->assertStringContainsString("/join/{$invData['code']}", $invData['joinUrl']);

        // 3. Host lists invitations
        $listRes = $this->getJson("/room/{$slug}/invitations");
        $listRes->assertStatus(200);
        $list = $listRes->json();
        $this->assertCount(1, $list);
        $this->assertEquals($invData['code'], $list[0]['code']);

        // 4. Host revokes invitation
        $revokeRes = $this->postJson("/room/{$slug}/invitations/{$invData['code']}/revoke");
        $revokeRes->assertStatus(200);
        $this->assertTrue($revokeRes->json('success'));
        $this->assertEquals('revoked', $revokeRes->json('invitation.status'));
    }

    /**
     * Test complete guest join flow via invitation.
     */
    public function test_guest_can_view_and_join_via_invitation_flow(): void
    {
        // 1. Host creates room and invitation
        $this->post('/meetings', [
            'title' => 'Engineering Sync',
            'hostName' => 'Tech Lead',
        ]);
        $slug = null;
        foreach (session()->all() as $key => $val) {
            if (str_starts_with($key, 'room_host_')) {
                $slug = substr($key, strlen('room_host_'));
                break;
            }
        }

        $invRes = $this->postJson("/room/{$slug}/invitations", [
            'role' => 'participant',
            'expiresInSeconds' => 7200,
        ]);
        $code = $invRes->json('code');

        // 2. Clear host session to simulate new guest visitor
        session()->flush();

        // 3. Guest visits /join/{code}
        $joinViewRes = $this->get("/join/{$code}");
        $joinViewRes->assertStatus(200);
        $joinViewRes->assertSee('Engineering Sync');
        $joinViewRes->assertSee('Participant');
        $joinViewRes->assertSee('Your Display Name');

        // 4. Guest submits name to join
        $joinSubmitRes = $this->post("/join/{$code}", [
            'name' => 'Charlie Developer',
        ]);
        $joinSubmitRes->assertStatus(302);
        $joinSubmitRes->assertRedirect("/room/{$slug}");

        // 5. Guest enters meeting room
        $roomRes = $this->get("/room/{$slug}");
        $roomRes->assertStatus(200);
        $roomRes->assertSee('Charlie Developer');
        $roomRes->assertSee('participant');
        // Host controls must NOT be visible in DOM
        $roomRes->assertDontSee('<button id="btn-toggle-recording"', false);
        $roomRes->assertDontSee('<button id="btn-open-invite-modal"', false);
    }

    /**
     * Test viewer invitation enforces read-only attendee mode.
     */
    public function test_viewer_invitation_enforces_read_only_mode(): void
    {
        // Host creates room and viewer invitation
        $this->post('/meetings', [
            'title' => 'Company Keynote',
            'hostName' => 'CEO',
        ]);
        $slug = null;
        foreach (session()->all() as $key => $val) {
            if (str_starts_with($key, 'room_host_')) {
                $slug = substr($key, strlen('room_host_'));
                break;
            }
        }

        $invRes = $this->postJson("/room/{$slug}/invitations", [
            'role' => 'viewer',
            'expiresInSeconds' => 3600,
        ]);
        $code = $invRes->json('code');

        // Guest visits as viewer
        session()->flush();
        $joinViewRes = $this->get("/join/{$code}");
        $joinViewRes->assertStatus(200);
        $joinViewRes->assertSee('Viewer (Read-Only)');

        // Join as viewer
        $joinSubmitRes = $this->post("/join/{$code}", [
            'name' => 'Audience Member',
        ]);
        $joinSubmitRes->assertStatus(302);

        $roomRes = $this->get("/room/{$slug}");
        $roomRes->assertStatus(200);
        $roomRes->assertSee('Audience Member');
        $roomRes->assertSee('viewer');
    }

    /**
     * Test security: Malicious guest tampering and unauthorized actions.
     */
    public function test_malicious_guest_cannot_tamper_invitation_or_escalate_role(): void
    {
        // Host creates room
        $this->post('/meetings', [
            'title' => 'Executive Secret Session',
            'hostName' => 'Authorized Host',
        ]);
        $slug = null;
        foreach (session()->all() as $key => $val) {
            if (str_starts_with($key, 'room_host_')) {
                $slug = substr($key, strlen('room_host_'));
                break;
            }
        }

        $invRes = $this->postJson("/room/{$slug}/invitations", [
            'role' => 'viewer',
        ]);
        $code = $invRes->json('code');

        // Attacker clears session
        session()->flush();

        // 1. Attacker attempts to create an invitation without host credentials
        $unauthCreateRes = $this->postJson("/room/{$slug}/invitations", [
            'role' => 'participant',
        ]);
        $unauthCreateRes->assertStatus(403);

        // 2. Attacker attempts to list invitations without host credentials
        $unauthListRes = $this->getJson("/room/{$slug}/invitations");
        $unauthListRes->assertStatus(403);

        // 3. Attacker attempts to revoke invitation without host credentials
        $unauthRevokeRes = $this->postJson("/room/{$slug}/invitations/{$code}/revoke");
        $unauthRevokeRes->assertStatus(403);

        // 4. Attacker joins through viewer invitation, then attempts role escalation to host
        $this->post("/join/{$code}", ['name' => 'Eve Attacker']);
        $escalateRes = $this->get("/room/{$slug}?role=host");
        $escalateRes->assertStatus(200);
        $escalateRes->assertSee('viewer');
        $escalateRes->assertDontSee('<button id="btn-toggle-recording"', false);
        $escalateRes->assertDontSee('<button id="btn-open-invite-modal"', false);
    }

    /**
     * Test revoked, expired, and invalid invitation handling.
     */
    public function test_revoked_and_expired_and_invalid_invitations_are_rejected(): void
    {
        // 1. Invalid code
        $invalidRes = $this->get('/join/completely-bogus-code-404');
        $invalidRes->assertStatus(200);
        $invalidRes->assertSee('Invalid Invitation Link');

        $invalidPostRes = $this->post('/join/completely-bogus-code-404', ['name' => 'Test User']);
        $invalidPostRes->assertStatus(302);
        $invalidPostRes->assertSessionHasErrors(['error']);

        // 2. Revoked code
        $this->post('/meetings', [
            'title' => 'Restricted Meeting',
            'hostName' => 'Security Admin',
        ]);
        $slug = null;
        foreach (session()->all() as $key => $val) {
            if (str_starts_with($key, 'room_host_')) {
                $slug = substr($key, strlen('room_host_'));
                break;
            }
        }

        $invRes = $this->postJson("/room/{$slug}/invitations", [
            'role' => 'participant',
        ]);
        $code = $invRes->json('code');

        // Revoke
        $this->postJson("/room/{$slug}/invitations/{$code}/revoke");

        // Clear session and test guest access to revoked code
        session()->flush();
        $revokedViewRes = $this->get("/join/{$code}");
        $revokedViewRes->assertStatus(200);
        $revokedViewRes->assertSee('Invitation Revoked');

        $revokedPostRes = $this->post("/join/{$code}", ['name' => 'Late Comer']);
        $revokedPostRes->assertStatus(302);
        $revokedPostRes->assertSessionHasErrors(['error']);
    }
}
