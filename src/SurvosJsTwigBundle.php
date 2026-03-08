<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle;

use FOS\JsRoutingBundle\Extractor\ExposedRoutesExtractorInterface;
use FOS\JsRoutingBundle\Response\RoutesResponse;
use Survos\CoreBundle\Traits\HasAssetMapperTrait;
use Survos\JsTwigBundle\CacheWarmer\FosRoutingCacheWarmer;
use Survos\JsTwigBundle\Components\DexieTwigComponent;
use Survos\JsTwigBundle\Components\JsTwigComponent;
use Survos\JsTwigBundle\Debug\JsTwigManifestRegistry;
use Survos\JsTwigBundle\Twig\TwigExtension;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\DependencyInjection\Reference;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

class SurvosJsTwigBundle extends AbstractBundle
{
    use HasAssetMapperTrait;

    /** Path (relative to project root) where the generated FOS routing ES module is written. */
    public const GENERATED_ASSET_DIR = 'var/js_twig_bundle/generated';

    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $builder->register(JsTwigManifestRegistry::class)
            ->setAutowired(true)
            ->setAutoconfigured(true);

        $builder->register(JsTwigComponent::class)
            ->setAutowired(true)
            ->setAutoconfigured(true)
            ->setArgument('$twig', new Reference('twig'))
            ->setArgument('$logger', new Reference('logger', ContainerInterface::NULL_ON_INVALID_REFERENCE))
            ->setArgument('$jsTwigManifestRegistry', new Reference(JsTwigManifestRegistry::class));

        $builder->register(DexieTwigComponent::class)
            ->setAutowired(true)
            ->setAutoconfigured(true)
            ->setArgument('$config', $config)
            ->setArgument('$twig', new Reference('twig'))
            ->setArgument('$logger', new Reference('logger', ContainerInterface::NULL_ON_INVALID_REFERENCE))
            ->setArgument('$jsTwigManifestRegistry', new Reference(JsTwigManifestRegistry::class));

        $builder->register(TwigExtension::class)
            ->setAutowired(true)
            ->setAutoconfigured(true)
            ->setArgument('$config', $config)
            ->setArgument('$registry', new Reference(JsTwigManifestRegistry::class))
            ->addTag('twig.extension');

        // Register the FOS routing cache warmer only when the FOS JsRouting bundle is present.
        if (interface_exists(ExposedRoutesExtractorInterface::class)) {
            $projectDir = $builder->getParameter('kernel.project_dir');
            $outputDir = $projectDir . '/' . self::GENERATED_ASSET_DIR;

            $builder->register(FosRoutingCacheWarmer::class)
                ->setAutowired(false)
                ->setAutoconfigured(true)
                ->setArgument('$extractor', new Reference('fos_js_routing.extractor'))
                ->setArgument('$routesResponse', new Reference('fos_js_routing.routes_response'))
                ->setArgument('$serializer', new Reference('fos_js_routing.serializer'))
                ->setArgument('$outputDir', $outputDir)
                ->addTag('kernel.cache_warmer');
        }
    }

    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
            ->children()
            ->booleanNode('debug')->defaultFalse()->end()
            ->scalarNode('version')->defaultValue(1)->end()
            ->scalarNode('db')->defaultValue('db')->end()
            ->arrayNode('stores')
            ->arrayPrototype()
            ->children()
            ->integerNode('batch')
                ->info("batch size when loading api")->defaultValue(null)->example("100")
            ->end()
            ->scalarNode('name')->info("the store name")->example("friendTable")->end()
            ->scalarNode('schema')->info("the index definition")->example("++i,age")->end()
            ->scalarNode('url')->info("the API to use to load if empty.  json-ld iterates through pages")
                ->example("/api/friends")
            ->end()
            ->scalarNode('response_key')->info("key if API returns an object response, e.g. dummyjson returns {'products': [...]}")->example("++i,age")->end()
            ->end()
            ->end()
            ->end()
            ->end();
    }


    public function getPaths(): array
    {
        $dir = realpath(__DIR__ . '/../assets/');
        assert(file_exists($dir), 'asset path must exist for the assets in ' . __DIR__);
        return [$dir => '@survos/js-twig'];
    }

    public function prependExtension(ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        if (!$this->isAssetMapperAvailable($builder)) {
            return;
        }

        $paths = $this->getPaths();

        // Also register the generated FOS routing directory when the FOS JsRouting bundle is present.
        if (interface_exists(ExposedRoutesExtractorInterface::class)) {
            $projectDir = (string) $builder->getParameter('kernel.project_dir');
            $generatedDir = $projectDir . '/' . self::GENERATED_ASSET_DIR;
            // Ensure the directory exists so AssetMapper can register it.
            if (!is_dir($generatedDir)) {
                mkdir($generatedDir, 0755, true);
            }
            $paths[$generatedDir] = '@survos/js-twig/generated';
        }

        $builder->prependExtensionConfig('framework', [
            'asset_mapper' => [
                'paths' => $paths,
            ],
        ]);
    }

}
