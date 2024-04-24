<?php

namespace Survos\JsTwigBundle\Components;

use Psr\Log\LoggerInterface;
use Survos\JsTwigBundle\TwigBlocksTrait;
use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;
use Twig\Environment;


#[AsTwigComponent(name: 'dexie', template: '@SurvosJsTwig/components/dexie_twig.html.twig')]
final class DexieTwigComponent extends AsTwigComponent
{
    use TwigBlocksTrait;
    public string $store; // required
    public ?iterable $globals=null;
    public null|string|int $key=null;
    public ?string $refreshEvent=null;

    public function __construct(
        private Environment $twig,
        private LoggerInterface $logger,
        private array $config=[]
    ) {

        //        ='@survos/grid-bundle/api_grid';
    }


    public function getRefreshEvent(): string
    {
        return $this->refreshEvent;
    }

    public function getFilter()
    {
        return $this->filter;
    }

    public function getStore(): string
    {
        return $this->store;
    }
    public null|object|array $filter = null;
    public array $order = [];


    public function getTwigTemplate(): string
    {
        assert(array_key_exists('twig_template', $this->getTwigBlocks()), "Missing 'twig_template' in " .
          $this->getTwigSource()
        );
        return $this->getTwigBlocks()['twig_template'];
    }

    public function getTwigTemplates()
    {
        return $this->getTwigBlocks();
    }

    public function getSchema(): array
    {
        #    db.version(3).stores({
#savedTable: "id,name,owned",
#productTable: "++id,price,brand,category"
#});

        $schema = [];
        foreach ($this->config['stores'] as $store) {
            $schema[$store['name']] = $store['schema'];
        }
        return $schema;
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    /**
     * The API Platform or other urls to pre-populate the database
     *
     * @return array
     */
    public function getTableUrls(): array
    {
        $tableUrls = [];
        foreach ($this->config['stores'] as $store) {
            if ($store['url']??false) {
                $tableUrls[$store['name']] = $store['url'];
            }
        }
        return $tableUrls;
    }


    public function getDbName()
    {
        return $this->config['db'];
    }
    public function getVersion(): int
    {
        return $this->config['version'];
    }



}
