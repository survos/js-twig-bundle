<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle\AssetMapper;

use Symfony\Component\AssetMapper\AssetMapperInterface;
use Symfony\Component\AssetMapper\Compiler\AssetCompilerInterface;
use Symfony\Component\AssetMapper\MappedAsset;
use Symfony\Component\Filesystem\Path;

/** Resolves bundle-owned routing imports before Symfony discovers dependencies. */
final class RoutingImportCompiler implements AssetCompilerInterface
{
    public function __construct(private readonly string $generatedDir)
    {
    }

    public function supports(MappedAsset $asset): bool
    {
        return 'js' === $asset->publicExtension;
    }

    public function compile(string $content, MappedAsset $asset, AssetMapperInterface $assetMapper): string
    {
        $routing = dirname(__DIR__, 2).'/assets/routing.js';
        $imports = [
            '@survos/js-twig-bundle/routing' => $routing,
            '@survos/js-twig-bundle/routing.js' => $routing,
            // Pre-rename specifiers, so consumers keep working without an importmap entry.
            '@survos/js-twig/routing' => $routing,
            '@survos/js-twig/routing.js' => $routing,
            '@survos/js-twig/generated/fos_routes.js' => $routing,
        ];
        if ('@survos/js-twig-bundle/routing.js' === $asset->logicalPath) {
            $imports['./routes.json'] = $this->generatedDir.'/routes.json';
        }

        if (!array_any(array_keys($imports), static fn (string $specifier): bool => str_contains($content, $specifier))) {
            return $content;
        }

        // Skip comments and strings so examples embedded in JS are not rewritten.
        $pattern = <<<'REGEX'
~//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?<prefix>\b(?:import\s*(?:[\w\s{},*]+\s+from\s*|\(\s*)|export\s*[\w\s{},*]+\s+from\s*))(?<quote>['"])(?<specifier>[^'"\n]+)\k<quote>~
REGEX;

        return preg_replace_callback($pattern, static function (array $match) use ($imports, $asset): string {
            if (!isset($imports[$match['specifier'] ?? ''])) {
                return $match[0];
            }
            $relative = Path::makeRelative($imports[$match['specifier']], dirname($asset->sourcePath));
            if (!str_starts_with($relative, '.')) {
                $relative = './'.$relative;
            }
            return $match['prefix'].$match['quote'].$relative.$match['quote'];
        }, $content) ?? throw new \RuntimeException('Unable to resolve routing imports: '.preg_last_error_msg());
    }
}
