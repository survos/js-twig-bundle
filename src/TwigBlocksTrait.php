<?php

namespace Survos\JsTwigBundle;

use Symfony\Component\DomCrawler\Crawler;

trait TwigBlocksTrait
{

    public string $caller;
    // must inject twig!

    public function getTwigBlocks(?string $id=null): array
    {
        $customColumnTemplates = [];
        $allTwigBlocks = [];
//        dd($this->twig->getLoader()->cache, $id, $this->caller);
        if ($this->caller) {
            //            $template = $this->twig->resolveTemplate($this->caller);
            $sourceContext = $this->twig->getLoader()->getSourceContext($this->caller);
            $path = $sourceContext->getPath();
//            $this->path = $path;
//            dd($sourceContext, $sourceContext->getCode());

            //            dd($template);


            //            $this->source = $source;
            //            dd($this->twig);
            // get rid of comments
            $source = file_get_contents($path);
            $source = preg_replace('/{#.*?#}/', '', $source);

            // first, get the component twig

//            if (0)
//            {
//
            /*                if (preg_match('|<twig:api_grid.*?>(.*?)</twig:api_grid>|ms', $source, $mm)) {*/
//                    $twigBlocks = $mm[1];
//                    $componentHtml = $mm[0];
//                    $componentHtml = <<<END
//    <twig:Alert>
//        <twig:block name="footer">
//            <button class="btn btn-primary">Claim your prize</button>
//        </twig:block>
//    </twig:Alert>
//END;
//                    $crawler = new Crawler($componentHtml);
//                    $crawler->registerNamespace('twig','fake');
//                    foreach (['twig:block', 'alert', 'Alter', 'twig|alert', 'twig|block', 'twig', 'block'] as $hack) {
////                        $crawler->filterXPath($hack)->each(fn(Crawler $node) => dd($node, $node->nodeName(), $source));
//                    }
//
////                    dd($componentHtml);
////                    $componentHtml = "<html>$componentHtml</html>";
//
//                } else {
////                    dd($source);
//                    $twigBlocks = $source;
//                }
//
//            }

            // this blows up with nested blocks.  Also, issue with {% block title %}
            if (preg_match('/component.*?%}(.*?) endcomponent/ms', $source, $mm)) {
                $twigBlocks = $mm[1];
            } else {
                $twigBlocks = $source;
            }

            $componentHtml = str_replace(['twig:', 'xmlns:twig="http://example.com/twig"'], '', $source);

            $crawler = new Crawler();
            $crawler->addHtmlContent($componentHtml);
            $allTwigBlocks = [];
            // use an ID to select a specific template, regardless of where it is in the page.
            if ($this->getId()) {
                $selector = '#' . $this->getId();
                $text = $crawler->filter($selector)->html();
                $text =  urldecode($text);
                $customColumnTemplates[$this->getId()] = $text;
                return $customColumnTemplates;
            }

            // <twig:block only, not component
            if ($crawler->filterXPath('//block')->count() > 0) {

                $allTwigBlocks = $crawler->filterXPath('//block')->each(function (Crawler $node, $i) {
//                    https://stackoverflow.com/questions/15133541/get-raw-html-code-of-element-with-symfony-domcrawler
                    $blockName = $node->attr('name');
                    $html = rawurldecode($node->html());
                    // hack for twig > and <
                    $html = str_replace(['&lt;', '&gt;'], ['<', '>'], $html);
//                    dd($blockName, $html);
                    return [$blockName => $html];
                });
            }


            if (preg_match_all('/{% block (.*?) %}(.*?){% endblock/ms', $twigBlocks, $mm, PREG_SET_ORDER)) {
                foreach ($mm as $m) {
                    [$all, $columnName, $twigCode] = $m;
                    $customColumnTemplates[$columnName] = trim($twigCode);
                }
            }
        }
        foreach ($allTwigBlocks as $allTwigBlock) {
            foreach ($allTwigBlock as $key => $value) {
                $customColumnTemplates[$key] = $value;
            }
        }

        return $customColumnTemplates;
    }

    public function getId()
    {
        return $this->id??null;
    }



}
