<?php

require_once __DIR__ . '/../vendor/autoload.php';

use NexusRTC\Client\NexusRtcClient;
use NexusRTC\Client\Exceptions\NexusRtcException;

echo "=== Testing NexusRTC PHP Client ===\n";

$client = new NexusRtcClient('http://127.0.0.1:4000', 'nexusrtc-master-api-key');

try {
    // 1. Create Room
    echo "[1] Creating Room...\n";
    $room = $client->createRoom([
        'title' => 'Laravel Sprint Planning',
        'hostId' => 'laravel-admin-1',
        'features' => [
            'recordingEnabled' => true,
            'chatEnabled' => true,
            'breakoutRoomsEnabled' => true,
            'screenShareEnabled' => true
        ]
    ]);
    echo "  -> Created Room ID: {$room->id}, Slug: {$room->slug}\n";

    // 2. Fetch Room
    echo "[2] Fetching Room by Slug...\n";
    $fetched = $client->getRoom($room->slug);
    echo "  -> Fetched Room: {$fetched->title} (Status: {$fetched->status})\n";

    // 3. Generate Host Token
    echo "[3] Generating Host Token...\n";
    $hostTokenRes = $client->generateJoinToken($room->slug, [
        'participantId' => 'laravel-admin-1',
        'name' => 'Laravel Admin Host',
        'role' => 'host'
    ]);
    echo "  -> Host Token: " . substr($hostTokenRes['token'], 0, 25) . "...\n";

    // 4. Generate Participant Token
    echo "[4] Generating Participant Token...\n";
    $partTokenRes = $client->generateJoinToken($room->slug, [
        'participantId' => 'laravel-user-2',
        'name' => 'Laravel Participant',
        'role' => 'participant'
    ]);
    echo "  -> Participant Token: " . substr($partTokenRes['token'], 0, 25) . "...\n";

    // 5. Test Breakout Room API
    echo "[5] Creating Breakout Room...\n";
    $breakout = $client->createBreakoutRoom($room->id, 'Backend Discussion', 20);
    echo "  -> Breakout Room Created ID: {$breakout['id']}, Name: {$breakout['name']}\n";

    // 6. Test Recording Trigger API
    echo "[6] Triggering Recording Start & Stop...\n";
    $recStart = $client->startRecording($room->id);
    echo "  -> Recording Started: {$recStart['id']} (Status: {$recStart['status']})\n";

    $recStop = $client->stopRecording($recStart['id']);
    echo "  -> Recording Stopped: {$recStop['id']} (Status: {$recStop['status']}, Duration: {$recStop['durationSeconds']}s)\n";
    // 7. Test Invitations API
    echo "[7] Testing Invitations API...\n";
    $invitation = $client->createInvitation($room->slug, [
        'role' => 'participant',
        'expiresInSeconds' => 3600,
        'maxUses' => 5
    ]);
    echo "  -> Created Invitation Code: {$invitation['code']}, Role: {$invitation['role']}\n";

    $invList = $client->listInvitations($room->slug);
    echo "  -> Listed Invitations Count: " . count($invList) . "\n";

    $invDetails = $client->getInvitation($invitation['code']);
    echo "  -> Inspected Invitation Code: {$invDetails['code']}, IsValid: " . ($invDetails['isValid'] ? 'true' : 'false') . "\n";

    $revoked = $client->revokeInvitation($invitation['code']);
    echo "  -> Revoked Invitation Code: {$revoked['invitation']['code']}, Status: {$revoked['invitation']['status']}\n";

    echo "\n>>> All PHP Client Tests Passed Successfully! <<<\n";
} catch (NexusRtcException $e) {
    echo "PHP SDK Error: " . $e->getMessage() . "\n";
    exit(1);
}
