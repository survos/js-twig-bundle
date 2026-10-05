<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle\CacheWarmer;

use Survos\JsTwigBundle\Routing\ExposedRoutesExtractor;
use Survos\JsTwigBundle\Routing\RoutesResponse;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\HttpKernel\CacheWarmer\CacheWarmerInterface;

/** Writes exposed route data during normal Symfony cache warmup. */
final class FosRoutingCacheWarmer implements CacheWarmerInterface
{
    public function __construct(
        private readonly ExposedRoutesExtractor $extractor,
        private readonly string $outputDir,
    ) {}

    public function warmUp(string $cacheDir, ?string $buildDir = null): array
    {
        if (!is_dir($this->outputDir)) {
            if (!mkdir($this->outputDir, 0755, true) && !is_dir($this->outputDir)) {
                throw new \RuntimeException(sprintf('Unable to create routing output directory "%s".', $this->outputDir));
            }
        }

        $response = new RoutesResponse(
            baseUrl: $this->extractor->getBaseUrl(),
            prefix:  $this->extractor->getPrefix(),
            host:    $this->extractor->getHost(),
            port:    $this->extractor->getPort(),
            scheme:  $this->extractor->getScheme(),
        );
        $response->setRoutes($this->extractor->getRoutes());

        $json = json_encode($response, \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE | \JSON_THROW_ON_ERROR);

        $outputFile = rtrim($this->outputDir, '/') . '/routes.json';
        (new Filesystem())->dumpFile($outputFile, $json);

        // CacheWarmerInterface returns PHP files eligible for OPcache preloading.
        return [];
    }

    /**
     * Optional on purpose. Required warmers run during container compilation, before Doctrine's
     * (optional, priority 1000) metadata warmers, and collecting routes loads entity metadata
     * through API Platform's route loader. DoctrineMetadataCacheWarmer then finds metadata
     * already loaded and fails `cache:clear` in every app with API Platform and Doctrine.
     * A normal `cache:clear` still runs it, so routes.json exists before `asset-map:compile`.
     */
    public function isOptional(): bool
    {
        return true;
    }

}
