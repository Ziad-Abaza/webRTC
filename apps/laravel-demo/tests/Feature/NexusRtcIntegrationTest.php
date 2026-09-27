<?php

namespace Tests\Feature;

use Tests\TestCase;

class NexusRtcIntegrationTest extends TestCase
{
    /**
     * Test room creation, slug lookup, join token issuance, and room rendering via real NexusRTC engine.
     */
    public function test_full_meeting_lifecycle_via_nexusrtc(): void
    {
        // 1. Visit index page
        $response = $this->get('/');
        $response->assertStatus(200);
        $response->assertSee('NexusRTC Engine');

        // 2. Submit meeting creation
        $storeResponse = $this->post('/meetings', [
            'title' => 'Executive Sprint Review',
            'hostName' => 'Sarah Connor',
            'recordingEnabled' => 1,
            'chatEnabled' => 1,
            'breakoutRoomsEnabled' => 1,
        ]);

        $storeResponse->assertStatus(302);
        $redirectUrl = $storeResponse->headers->get('Location');
        $this->assertNotNull($redirectUrl);
        $this->assertStringContainsString('/room/', $redirectUrl);
        $this->assertTrue(str_contains($redirectUrl, 'Sarah%20Connor') || str_contains($redirectUrl, 'Sarah+Connor'));
        $this->assertStringContainsString('role=host', $redirectUrl);

        // 3. Follow redirect to room page with generated token & media config
        $roomResponse = $this->get($redirectUrl);
        $roomResponse->assertStatus(200);
        $roomResponse->assertSee('Executive Sprint Review');
        $roomResponse->assertSee('Sarah Connor');
        $roomResponse->assertSee('host');
        $roomResponse->assertSee('nexusrtc.bundle.js');
    }

    /**
     * Test participant joining with custom guest name.
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
        $response = $this->get("/room/{$room->slug}?name=John+Doe&role=participant");
        $response->assertStatus(200);
        $response->assertSee('All Hands Townhall');
        $response->assertSee('John Doe');
        $response->assertSee('participant');
    }
}
