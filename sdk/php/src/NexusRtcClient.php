<?php

namespace NexusRTC\Client;

use NexusRTC\Client\Exceptions\NexusRtcException;
use NexusRTC\Client\Models\Room;

class NexusRtcClient
{
    private string $baseUrl;
    private string $apiKey;
    private int $timeout;

    public function __construct(string $baseUrl, string $apiKey, int $timeout = 10)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
        $this->timeout = $timeout;
    }

    /**
     * Create a new video meeting room.
     */
    public function createRoom(array $params): Room
    {
        $data = $this->request('POST', '/api/v1/rooms', $params);
        return Room::fromArray($data);
    }

    /**
     * Get details of a room by ID or slug.
     */
    public function getRoom(string $idOrSlug): ?Room
    {
        try {
            $data = $this->request('GET', "/api/v1/rooms/{$idOrSlug}");
            return Room::fromArray($data);
        } catch (NexusRtcException $e) {
            if (str_contains($e->getMessage(), '404') || str_contains($e->getMessage(), 'not found')) {
                return null;
            }
            throw $e;
        }
    }

    /**
     * Generate an authorized join token for a participant or host.
     */
    public function generateJoinToken(string $roomIdOrSlug, array $participantData): array
    {
        return $this->request('POST', "/api/v1/rooms/{$roomIdOrSlug}/token", $participantData);
    }

    /**
     * Create an authoritative invitation for a room.
     */
    public function createInvitation(string $roomIdOrSlug, array $params = []): array
    {
        return $this->request('POST', "/api/v1/rooms/{$roomIdOrSlug}/invitations", $params);
    }

    /**
     * List all invitations for a room.
     */
    public function listInvitations(string $roomIdOrSlug): array
    {
        return $this->request('GET', "/api/v1/rooms/{$roomIdOrSlug}/invitations");
    }

    /**
     * Get details of an invitation by code (public/sanitized inspection).
     */
    public function getInvitation(string $code): ?array
    {
        try {
            return $this->request('GET', "/api/v1/invitations/{$code}");
        } catch (NexusRtcException $e) {
            if (str_contains($e->getMessage(), '404') || str_contains($e->getMessage(), 'not found')) {
                return null;
            }
            throw $e;
        }
    }

    /**
     * Revoke an invitation by code or ID.
     */
    public function revokeInvitation(string $codeOrId): array
    {
        return $this->request('POST', "/api/v1/invitations/{$codeOrId}/revoke");
    }

    /**
     * Get configured room permissions and role capabilities.
     */
    public function getRoomPermissions(string $roomIdOrSlug): array
    {
        return $this->request('GET', "/api/v1/rooms/{$roomIdOrSlug}/permissions");
    }

    /**
     * Authoritatively update room permissions, role capabilities, or global locks.
     */
    public function updateRoomPermissions(string $roomIdOrSlug, array $permissionsConfig): array
    {
        return $this->request('PUT', "/api/v1/rooms/{$roomIdOrSlug}/permissions", $permissionsConfig);
    }

    /**
     * List active participants in a room.
     */
    public function listParticipants(string $roomId): array
    {
        return $this->request('GET', "/api/v1/rooms/{$roomId}/participants");
    }

    /**
     * Start recording for a room.
     */
    public function startRecording(string $roomId): array
    {
        return $this->request('POST', "/api/v1/rooms/{$roomId}/recordings/start");
    }

    /**
     * Stop an active recording.
     */
    public function stopRecording(string $recordingId): array
    {
        return $this->request('POST', "/api/v1/recordings/{$recordingId}/stop");
    }

    /**
     * List recordings for a room.
     */
    public function listRecordings(string $roomId): array
    {
        return $this->request('GET', "/api/v1/rooms/{$roomId}/recordings");
    }

    /**
     * Create a breakout room.
     */
    public function createBreakoutRoom(string $roomId, string $name, ?int $durationMinutes = null): array
    {
        return $this->request('POST', "/api/v1/rooms/{$roomId}/breakouts", [
            'name' => $name,
            'durationMinutes' => $durationMinutes
        ]);
    }

    /**
     * Start live broadcasting stream (RTMP).
     */
    public function startBroadcast(string $roomId, string $streamUrl, string $streamKey): array
    {
        return $this->request('POST', "/api/v1/rooms/{$roomId}/broadcast/start", [
            'streamUrl' => $streamUrl,
            'streamKey' => $streamKey
        ]);
    }

    /**
     * Stop live broadcast.
     */
    public function stopBroadcast(string $roomId): array
    {
        return $this->request('POST', "/api/v1/rooms/{$roomId}/broadcast/stop");
    }

    /**
     * Authoritatively ban/evict a participant from the room session.
     */
    public function banParticipant(string $roomIdOrSlug, string $participantId): array
    {
        $perms = $this->getRoomPermissions($roomIdOrSlug);
        $banned = $perms['bannedParticipantIds'] ?? [];
        if (!in_array($participantId, $banned, true)) {
            $banned[] = $participantId;
        }
        return $this->updateRoomPermissions($roomIdOrSlug, [
            'bannedParticipantIds' => $banned
        ]);
    }

    /**
     * Internal HTTP request handler using curl.
     */
    protected function request(string $method, string $endpoint, array $data = []): array
    {
        $url = $this->baseUrl . $endpoint;
        $ch = curl_init();

        $headers = [
            'Accept: application/json',
            'X-API-Key: ' . $this->apiKey,
        ];

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);

        if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
            $jsonPayload = json_encode($data);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
            $headers[] = 'Content-Type: application/json';
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new NexusRtcException("NexusRTC API Connection Error: {$error}");
        }

        $decoded = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMessage = $decoded['error'] ?? "HTTP Request Failed with code {$httpCode}: {$response}";
            throw new NexusRtcException($errorMessage, $httpCode);
        }

        return $decoded ?: [];
    }
}
