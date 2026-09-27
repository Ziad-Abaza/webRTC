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
        $response->assertSee('NexusRTC Engine');
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
        $roomResponse->assertSee('nexusrtc.bundle.js');
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
    }
}
