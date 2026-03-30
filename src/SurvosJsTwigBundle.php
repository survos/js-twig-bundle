<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle;

use Survos\CoreBundle\Bundle\AssetMapperBundle;
use Survos\JsTwigBundle\CacheWarmer\FosRoutingCacheWarmer;
use Survos\JsTwigBundle\Components\DexieTwigComponent;
use Survos\JsTwigBundle\Components\JsTwigComponent;
use Survos\JsTwigBundle\Debug\JsTwigManifestRegistry;
use Survos\JsTwigBundle\Routing\ExposedRoutesExtractor;
use Survos\JsTwigBundle\Twig\TwigExtension;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\DependencyInjection\Reference;
class SurvosJsTwigBundle extends AssetMapperBundle
{
    public const ASSET_PACKAGE = 'js-twig';

    /** Path (relative to project root) where the generated routing ES module is written. */
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

        // Register our own ExposedRoutesExtractor (no third-party deps).
        $builder->register(ExposedRoutesExtractor::class)
            ->setAutowired(false)
            ->setAutoconfigured(false)
            ->setArgument('$router', new Reference('router'))
            ->setArgument('$routesToExpose', $config['routing']['routes_to_expose']);

        // Register the routing cache warmer unconditionally.
        $projectDir = $builder->getParameter('kernel.project_dir');
        $outputDir  = $projectDir . '/' . self::GENERATED_ASSET_DIR;

        $builder->register(FosRoutingCacheWarmer::class)
            ->setAutowired(false)
            ->setAutoconfigured(true)
            ->setArgument('$extractor', new Reference(ExposedRoutesExtractor::class))
            ->setArgument('$outputDir', $outputDir)
            ->addTag('kernel.cache_warmer');
    }

    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
            ->children()
                ->booleanNode('debug')->defaultFalse()->end()
                ->scalarNode('version')->defaultValue(1)->end()
                ->scalarNode('db')->defaultValue('db')->end()
                ->arrayNode('routing')
                    ->addDefaultsIfNotSet()
                    ->children()
                        ->arrayNode('routes_to_expose')
                            ->info('Route names or regex patterns (e.g. "/^app_/") to expose to the JS path() generator.')
                            ->scalarPrototype()->end()
                            ->defaultValue([])
                        ->end()
                    ->end()
                ->end()
                ->arrayNode('stores')
                    ->arrayPrototype()
                        ->children()
                            ->integerNode('batch')
                                ->info('batch size when loading api')->defaultValue(null)->example('100')
                            ->end()
                            ->scalarNode('name')->info('the store name')->example('friendTable')->end()
                            ->scalarNode('schema')->info('the index definition')->example('++i,age')->end()
                            ->scalarNode('url')->info('the API to use to load if empty.  json-ld iterates through pages')
                                ->example('/api/friends')
                            ->end()
                            ->scalarNode('response_key')->info("key if API returns an object response, e.g. dummyjson returns {'products': [...]}")->example('++i,age')->end()
                        ->end()
                    ->end()
                ->end()
            ->end();
    }

    public function prependExtension(ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        if (!$this->isAssetMapperAvailable($builder)) {
            return;
        }

        $paths = $this->getPaths();

        // Always register the generated routing directory as an AssetMapper path.
        $projectDir   = (string) $builder->getParameter('kernel.project_dir');
        $generatedDir = $projectDir . '/' . self::GENERATED_ASSET_DIR;
        if (!is_dir($generatedDir)) {
            mkdir($generatedDir, 0755, true);
        }
        $paths[$generatedDir] = '@survos/js-twig/generated';

        $builder->prependExtensionConfig('framework', [
            'asset_mapper' => [
                'paths' => $paths,
            ],
        ]);
    }
}
