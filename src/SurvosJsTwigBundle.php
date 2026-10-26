<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle;

use Survos\JsTwigBundle\Components\DexieTwigComponent;
use Survos\JsTwigBundle\Components\JsTwigComponent;
use Survos\JsTwigBundle\Debug\JsTwigManifestRegistry;
use Survos\JsTwigBundle\Twig\TwigExtension;
use Survos\Kit\AbstractUxBundle;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\DependencyInjection\Reference;

// Symfony\Component\HttpKernel\Bundle\Bundle <-- Flex auto-registration marker (see Survos\Kit\AbstractSurvosBundle)
class SurvosJsTwigBundle extends AbstractUxBundle
{
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
    }

    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
            ->children()
                ->booleanNode('debug')->defaultFalse()->end()
                ->scalarNode('version')->defaultValue(1)->end()
                ->scalarNode('db')->defaultValue('db')->end()
                ->arrayNode('routing')
                    ->setDeprecated('survos/js-twig-bundle', '2.43', 'The "%node%" option does nothing: browser path() comes from symfony/ux-router. Expose routes with "ux_router.routes" or the route "expose" option, then remove this key.')
                    ->ignoreExtraKeys()
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
}
