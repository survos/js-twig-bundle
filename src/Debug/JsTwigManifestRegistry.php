<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle\Debug;

final class JsTwigManifestRegistry
{
    /** @var array<string, array<string, mixed>> */
    private array $manifests = [];

    /**
     * @param array<string, mixed> $manifest
     */
    public function register(string $manifestId, array $manifest): void
    {
        $this->manifests[$manifestId] = $manifest;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function all(): array
    {
        return $this->manifests;
    }
}
