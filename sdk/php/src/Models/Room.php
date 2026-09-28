<?php

namespace WebRTC\Client\Models;

class Room implements \JsonSerializable
{
    public function __construct(
        public readonly string $id,
        public readonly string $slug,
        public readonly string $title,
        public readonly string $status,
        public readonly string $hostId,
        public readonly ?string $hostKey = null,
        public readonly string $mediaProvider = 'jitsi',
        public readonly array $mediaConfig = [],
        public readonly array $features = [],
        public readonly array $permissions = [],
        public readonly ?string $description = null,
        public readonly array $metadata = []
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            id: $data['id'] ?? '',
            slug: $data['slug'] ?? '',
            title: $data['title'] ?? '',
            status: $data['status'] ?? 'active',
            hostId: $data['hostId'] ?? '',
            hostKey: $data['hostKey'] ?? null,
            mediaProvider: $data['mediaProvider'] ?? 'jitsi',
            mediaConfig: $data['mediaConfig'] ?? [],
            features: $data['features'] ?? [],
            permissions: $data['permissions'] ?? [],
            description: $data['description'] ?? null,
            metadata: $data['metadata'] ?? []
        );
    }

    public function toArray(bool $includeSecrets = false): array
    {
        $data = [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'status' => $this->status,
            'hostId' => $this->hostId,
            'mediaProvider' => $this->mediaProvider,
            'mediaConfig' => $this->mediaConfig,
            'features' => $this->features,
            'permissions' => $this->permissions,
            'description' => $this->description,
            'metadata' => $this->metadata,
        ];
        if ($includeSecrets && $this->hostKey !== null) {
            $data['hostKey'] = $this->hostKey;
        }
        return $data;
    }

    public function jsonSerialize(): array
    {
        // When serialized into JSON (e.g. for views or client-side config),
        // hostKey is strictly excluded to prevent privilege leakage.
        return $this->toArray(false);
    }
}

if (!class_exists('NexusRTC\Client\Models\Room', false)) {
    class_alias(Room::class, 'NexusRTC\Client\Models\Room');
}

