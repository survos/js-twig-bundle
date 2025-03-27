<?php

namespace Survos\JsTwigBundle\Components;

use Psr\Log\LoggerInterface;
use Survos\JsTwigBundle\TwigBlocksTrait;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;
use Symfony\UX\TwigComponent\Attribute\PreMount;
use Twig\Environment;


#[AsTwigComponent(name: 'dexie', template: '@SurvosJsTwig/components/dexie_twig.html.twig')]
final class DexieTwigComponent extends AsTwigComponent
{
    use TwigBlocksTrait;
    public iterable|object|string $store;
    public iterable|object|null $globals=null;
    public null|string|int $key=null;
    public ?string $refreshEvent=null;
//    public array $dbConfig=[]; // this is passed in!
    public ?string $url = null;
    // public string $caller; // in TwigBlocksTrait
    public bool $initDb = false;

    public function __construct(
        private Environment $twig,
        private LoggerInterface $logger,
        private array $config=[], // this is the config defined in survos_js_twig.yaml
    ) {

        //        ='@survos/grid-bundle/api_grid';
    }


    public function getFilter()
    {
        return $this->filter;
    }

    public function getStoreName(): ?string
    {
        return $this->storeName;
    }
    public function getStore(): array|object|null
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
        return $this->getTwigBlocks()['twig_template']['html'];
    }

    public function getTwigTemplates()
    {
        return $this->getTwigBlocks();
    }

    public function getSchema(): array
    {
//        assert(false);
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

    #[PreMount]
    public function preMount(array $data): array
    {
        if (json_validate($data['store'])) {
            $data['store'] = json_decode($data['store'], true);
        } else {
            $data['store'] = [
                'name' => $data['store'],
            ];
        }
        // validate data
        $resolver = (new OptionsResolver())
            ->setDefaults([
                'caller' => null,
                'refreshEvent' => null,
                'key' => null,
                'filter' => [],
//                'dbConfig' => [],
                'globals' => (object)[],
                'store' => null,
                'initDb' => false,
            ]);
        if (array_key_exists('globals', $data) && is_array($data['globals'])) {
            $data['globals'] = (object)$data['globals'];
        }
        $resolver->setRequired([
            'store',
            'caller',
            'refreshEvent',
        ]);
        // either store or dbConfig. store is empty for loadData, which loads all the stores defined
        $resolver
            ->setAllowedTypes('key', ['null', 'string','int'])
            ->setAllowedTypes('filter', ['array'])
            ->setAllowedTypes('store', ['array'])
            ->setAllowedTypes('globals', ['object'])
        ;

        $data = $resolver->resolve($data);
        return $data;
    }




}
