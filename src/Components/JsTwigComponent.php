<?php

// this was from ApiGrid, may no longer be relevant if dexie is optional or data can be passed in (via JSON?)
namespace Survos\JsTwigBundle\Components;

use Psr\Log\LoggerInterface;
use Survos\JsTwigBundle\TwigBlocksTrait;
use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;
use Twig\Environment;

#[AsTwigComponent('jsTwig', template: '@SurvosJsTwig/components/js_twig.html.twig')]
class JsTwigComponent // implements TwigBlocksInterface
{
    use TwigBlocksTrait;

    public string $caller;
    public string $id; // for parsing out the twig blocks
    public function __construct(
        private Environment $twig,
        private LoggerInterface $logger,
    ) {

        //        ='@survos/grid-bundle/api_grid';
    }


}
