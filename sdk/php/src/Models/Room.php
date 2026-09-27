<?php

namespace NexusRTC\Client\Models;

class Room
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

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'status' => $this->status,
            'hostId' => $this->hostId,
            'features' => $this->features,
            'description' => $this->description,
            'metadata' => $this->metadata,
        ];
    }
}
