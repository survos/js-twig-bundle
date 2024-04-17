<?php

namespace Survos\JsTwigBundle;

use Survos\CoreBundle\Traits\HasAssetMapperTrait;
use Survos\JsTwigBundle\Components\DexieTwigComponent;
use Survos\JsTwigBundle\Components\JsTwigComponent;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\DependencyInjection\Reference;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

class SurvosJsTwigBundle extends AbstractBundle
{
    use HasAssetMapperTrait;

    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {

        $builder->register(JsTwigComponent::class)
            ->setAutowired(true)
            ->setAutoconfigured(true)
            ->setArgument('$twig', new Reference('twig'))
            ->setArgument('$logger', new Reference('logger', ContainerInterface::NULL_ON_INVALID_REFERENCE));

        $builder->register(DexieTwigComponent::class)
            ->setAutowired(true)
            ->setAutoconfigured(true)
            ->setArgument('$config', $config)
            ->setArgument('$twig', new Reference('twig'))
            ->setArgument('$logger', new Reference('logger', ContainerInterface::NULL_ON_INVALID_REFERENCE));

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
            ->scalarNode('name')->info("the store name")->example("friendTable")->end()
            ->scalarNode('schema')->info("the index definition")->example("++i,age")->end()
            ->scalarNode('url')->info("the API to use to load if empty.  json-ld iterates through pages")
            ->example("/api/friends")
            ->end()
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

}
