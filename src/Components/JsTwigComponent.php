<?php

// this was from ApiGrid, may no longer be relevant if dexie is optional or data can be passed in (via JSON?)
namespace Survos\JsTwigBundle\Components;

use Psr\Log\LoggerInterface;
use Survos\JsTwigBundle\Debug\JsTwigManifestRegistry;
use Survos\JsTwigBundle\TwigBlocksInterface;
use Survos\JsTwigBundle\TwigBlocksTrait;
use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;
use Twig\Environment;

#[AsTwigComponent('jsTwig', template: '@SurvosJsTwig/components/js_twig.html.twig')]
class JsTwigComponent implements TwigBlocksInterface
{
    use TwigBlocksTrait;

    public string $caller;
    public string $apiUrl;
    public function __construct(
        private Environment $twig,
        private LoggerInterface $logger,
        JsTwigManifestRegistry $jsTwigManifestRegistry,
    ) {
        $this->jsTwigManifestRegistry = $jsTwigManifestRegistry;
        //        ='@survos/grid/api_grid';
    }


}
