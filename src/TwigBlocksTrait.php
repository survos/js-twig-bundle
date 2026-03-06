<?php

namespace Survos\JsTwigBundle;

use Survos\JsTwigBundle\Debug\JsTwigManifestRegistry;
use Symfony\Component\DomCrawler\Crawler;

trait TwigBlocksTrait
{

    public string $caller;
    public ?string $id = null;
    protected ?JsTwigManifestRegistry $jsTwigManifestRegistry = null;
    // must inject twig!

    public function getTwigSource()
    {
        $source = null;
        assert($this->caller, "Missing caller!");
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
        }
        return $source;

    }

    public function getTwigBlocks(?string $id=null): array
    {
        $customColumnTemplates = [];
        $allTwigBlocks = [];
        $source = $this->getTwigSource();
        if ($source)
        {
            // this blows up with nested blocks.  Also, issue with {% block title %}
//            if (preg_match('|<twig:block (.*?)>(.*?)</twig:block>|ms', $source, $mm)) {
//                dd($mm);
//                $twigBlocks = $mm[1];
//                dd($twigBlocks);
//            } else {
//                $twigBlocks = $source;
//            }

            $componentHtml = str_replace(['twig:', 'xmlns:twig="http://example.com/twig"'], '', $source);
            $crawler = new Crawler();
            $crawler->addHtmlContent($componentHtml);
            $allTwigBlocks = [];
            // use an ID to select a specific template, regardless of where it is in the page.
            if ($id = $this->getId()) {
                $selector = '#' . $this->getId();
                $text = $crawler->filter($selector)->html();
                $text =  urldecode($text);

                $customColumnTemplates[$this->getId()] = $text;
                return $customColumnTemplates;
            }

            // <twig:block only, not component
            $blocks = $crawler->filterXPath('//block');
            if ($blocks->count() > 0) {


                $allTwigBlocks = $blocks->each(function (Crawler $node, $i) use ($componentHtml) {
//                    dd($node);
//                    foreach ($crawler->getNode(0)->attributes as $attribute) {
//                        dd($attribute->name, $attribute->value);
//                    }




                    //                    https://stackoverflow.com/questions/15133541/get-raw-html-code-of-element-with-symfony-domcrawler
                    $blockName = $node->attr('name');
                    $wrapper = $node->attr('data-element');
                    $id = $node->attr('id', null);
                    $extras = [];
                    if ($id) {
                        $preg = sprintf('id="%s"(.*?)>(.*?)<!-- *%s', $id, $id);
                        if (preg_match("/$preg/sm", $componentHtml, $mm)) {
                            $extras = $mm[1];
                            $html = $mm[2];
                        } else {
                            throw new \Exception("Invalid closing for : $id in {$this->caller}" . $componentHtml);
                        }
                    } else {
                        $html = $node->html();
                    }

                    $html = rawurldecode($html);
//                    file_put_contents('./$.html', $html);
                    // hack for twig > and <
                    $html = str_replace(['&lt;', '&gt;'], ['<', '>'], $html);
//                    dd(false, $node->text());
                    return [$blockName => ['extra' => $extras, 'wrapper' => $wrapper, 'html' => $html]];
                });
            }

//            if (preg_match_all('/{% block (.*?) %}(.*?){% endblock/ms', $twigBlocks, $mm, PREG_SET_ORDER)) {
//                foreach ($mm as $m) {
//                    [$all, $columnName, $twigCode] = $m;
//                    $customColumnTemplates[$columnName] = trim($twigCode);
//                }
//            }
        }
        foreach ($allTwigBlocks as $allTwigBlock) {
            foreach ($allTwigBlock as $key => $value) {
                $customColumnTemplates[$key] = $value;
            }
        }

        return $customColumnTemplates;
    }

    public function getJsTwigScriptTagId(): string
    {
        if ($this->id) {
            return $this->id;
        }

        return 'jstwig-' . substr(md5((string) $this->caller), 0, 10);
    }

    public function getJsTwigManifest(): array
    {
        $blocks = $this->getTwigBlocks();
        $names = array_keys($blocks);
        sort($names);

        $slots = [];
        foreach ($names as $name) {
            $slots[] = [
                'name' => $name,
                'sourceHash' => substr(sha1((string) ($blocks[$name]['html'] ?? '')), 0, 12),
                'wrapper' => $blocks[$name]['wrapper'] ?? null,
            ];
        }

        $manifest = [
            'manifestId' => $this->getJsTwigScriptTagId(),
            'caller' => $this->caller,
            'generatedAt' => (new \DateTimeImmutable())->format(DATE_ATOM),
            'blockCount' => count($names),
            'slots' => $slots,
        ];

        if ($this->jsTwigManifestRegistry instanceof JsTwigManifestRegistry) {
            $this->jsTwigManifestRegistry->register($this->getJsTwigScriptTagId(), $manifest);
        }

        return $manifest;
    }

    // we could require an interface for this.
    public function getId()
    {
        return $this->id??null;
    }



}
