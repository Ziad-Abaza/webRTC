<?php

namespace NexusRTC\Client\Laravel\Facades;

use Illuminate\Support\Facades\Facade;
use NexusRTC\Client\NexusRtcClient;

/**
 * @method static \NexusRTC\Client\Models\Room createRoom(array $params)
 * @method static \NexusRTC\Client\Models\Room|null getRoom(string $idOrSlug)
 * @method static array generateJoinToken(string $roomIdOrSlug, array $participantData)
 * @method static array listParticipants(string $roomId)
 * @method static array startRecording(string $roomId)
 * @method static array stopRecording(string $recordingId)
 * @method static array listRecordings(string $roomId)
 * @method static array createBreakoutRoom(string $roomId, string $name, ?int $durationMinutes = null)
 * @method static array startBroadcast(string $roomId, string $streamUrl, string $streamKey)
 * @method static array stopBroadcast(string $roomId)
 *
 * @see \NexusRTC\Client\NexusRtcClient
 */
class NexusRTC extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return NexusRtcClient::class;
    }
}
