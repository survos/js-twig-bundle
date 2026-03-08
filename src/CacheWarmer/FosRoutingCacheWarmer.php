<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle\CacheWarmer;

use FOS\JsRoutingBundle\Extractor\ExposedRoutesExtractorInterface;
use FOS\JsRoutingBundle\Response\RoutesResponse;
use Symfony\Component\HttpKernel\CacheWarmer\CacheWarmerInterface;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Generates an ES module containing the FOS JS routing data during cache warmup.
 *
 * The generated file is placed in %kernel.project_dir%/var/js_twig_bundle/fos_routes.js
 * and is registered as an AssetMapper path so it can be imported via:
 *   import { routingData } from '@survos/js-twig/generated/fos_routes.js';
 */
final class FosRoutingCacheWarmer implements CacheWarmerInterface
{
    public function __construct(
        private readonly ExposedRoutesExtractorInterface $extractor,
        private readonly RoutesResponse $routesResponse,
        private readonly SerializerInterface $serializer,
        private readonly string $outputDir,
    ) {}

    public function warmUp(string $cacheDir, ?string $buildDir = null): array
    {
        if (!is_dir($this->outputDir)) {
            if (!mkdir($this->outputDir, 0755, true) && !is_dir($this->outputDir)) {
                throw new \RuntimeException(sprintf('Unable to create FOS routing output directory "%s".', $this->outputDir));
            }
        }

        $this->routesResponse->setBaseUrl($this->extractor->getBaseUrl());
        $this->routesResponse->setRoutes($this->extractor->getRoutes());
        $this->routesResponse->setPrefix($this->extractor->getPrefix(''));
        $this->routesResponse->setHost($this->extractor->getHost());
        $this->routesResponse->setPort($this->extractor->getPort());
        $this->routesResponse->setScheme($this->extractor->getScheme());
        $this->routesResponse->setLocale('');
        $this->routesResponse->setDomains([]);

        $json = $this->serializer->serialize($this->routesResponse, 'json');

        $content = sprintf("export const routingData = %s;\n", $json);

        $outputFile = rtrim($this->outputDir, '/') . '/fos_routes.js';
        if (false === file_put_contents($outputFile, $content)) {
            throw new \RuntimeException(sprintf('Unable to write FOS routing file "%s".', $outputFile));
        }

        return [$outputFile];
    }

    public function isOptional(): bool
    {
        return true;
    }
}
