<?php

namespace Survos\JsTwigBundle;

use Survos\JsTwigBundle\Debug\JsTwigManifestRegistry;
use Symfony\Component\DomCrawler\Crawler;

trait TwigBlocksTrait
{

    public string $caller;
    public ?string $id = null;
    protected ?string $jsTwigScriptTagId = null;
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
            $selectedId = $id ?? $this->getId();
            if ($selectedId) {
                $selector = '#' . $selectedId;
                $text = $crawler->filter($selector)->html();
                $text =  urldecode($text);

                $customColumnTemplates[$selectedId] = $text;
                return $customColumnTemplates;
            }

            // <twig:block only, not component
            $blocks = $crawler->filterXPath('//block');
            if ($blocks->count() > 0) {


                $allTwigBlocks = $blocks->each(function (Crawler $node) {
//                    dd($node);
//                    foreach ($crawler->getNode(0)->attributes as $attribute) {
//                        dd($attribute->name, $attribute->value);
//                    }




                    //                    https://stackoverflow.com/questions/15133541/get-raw-html-code-of-element-with-symfony-domcrawler
                    $blockName = $node->attr('name');
                    if (!$blockName) {
                        throw new \InvalidArgumentException(sprintf('Missing required block name attribute in %s', (string) $this->caller));
                    }
                    $wrapper = $node->attr('data-element');
                    $html = $node->html() ?? '';

                    $html = rawurldecode($html);
//                    file_put_contents('./$.html', $html);
                    // hack for twig > and <
                    $html = str_replace(['&lt;', '&gt;'], ['<', '>'], $html);
//                    dd(false, $node->text());
                    return [$blockName => ['extra' => '', 'wrapper' => $wrapper, 'html' => $html]];
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
                if (array_key_exists($key, $customColumnTemplates)) {
                    throw new \RuntimeException(sprintf(
                        'Duplicate twig:block name "%s" detected in %s. Block names must be unique within one component template.',
                        $key,
                        (string) $this->caller
                    ));
                }
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

        if ($this->jsTwigScriptTagId) {
            return $this->jsTwigScriptTagId;
        }

        $callerHash = substr(md5((string) $this->caller), 0, 10);
        $instanceHash = substr(md5((string) spl_object_id($this)), 0, 6);
        $this->jsTwigScriptTagId = sprintf('jstwig-%s-%s', $callerHash, $instanceHash);

        return $this->jsTwigScriptTagId;
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
