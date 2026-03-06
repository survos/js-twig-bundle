<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle\Twig;

use Survos\JsTwigBundle\Debug\JsTwigManifestRegistry;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

final class TwigExtension extends AbstractExtension
{
    public function __construct(
        private array $config,
        private JsTwigManifestRegistry $registry,
    ) {
    }

    public function getFunctions(): array
    {
        return [
            new TwigFunction('jstwig_debug_panel', [$this, 'renderDebugPanel'], ['is_safe' => ['html']]),
            new TwigFunction('jstwig_manifest_registry', [$this, 'getManifestRegistry']),
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function getManifestRegistry(): array
    {
        return $this->registry->all();
    }

    public function renderDebugPanel(bool $enabled = true): string
    {
        if (!$enabled || !($this->config['debug'] ?? false)) {
            return '';
        }

        $serverRegistry = json_encode($this->registry->all(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($serverRegistry === false) {
            $serverRegistry = '{}';
        }

        return <<<HTML
<script>
  (function () {
    if (document.getElementById('jstwig-debug')) {
      return;
    }

    const panel = document.createElement('details');
    panel.id = 'jstwig-debug';
    panel.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:9999;width:min(720px,95vw);background:#fff;border:1px solid #ddd;border-radius:8px;padding:.5rem;box-shadow:0 6px 24px rgba(0,0,0,.14);font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;';
    panel.innerHTML = `
      <summary style="cursor:pointer;font-weight:600;">js-twig debug</summary>
      <div style="display:grid;gap:.5rem;margin-top:.5rem;">
        <div>
          <div style="font-weight:600;margin-bottom:.25rem;">Server manifest registry</div>
          <pre id="jstwig-server" style="max-height:12rem;overflow:auto;background:#f8f8f8;border:1px solid #eee;padding:.5rem;">{$serverRegistry}</pre>
        </div>
        <div>
          <div style="font-weight:600;margin-bottom:.25rem;">Runtime compiled registries</div>
          <pre id="jstwig-runtime-compiled" style="max-height:10rem;overflow:auto;background:#f8f8f8;border:1px solid #eee;padding:.5rem;"></pre>
        </div>
        <div>
          <div style="font-weight:600;margin-bottom:.25rem;">Runtime used template slots</div>
          <pre id="jstwig-runtime-used" style="max-height:12rem;overflow:auto;background:#f8f8f8;border:1px solid #eee;padding:.5rem;"></pre>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const snapshot = typeof window.__jstwigDebugSnapshot === 'function'
      ? window.__jstwigDebugSnapshot()
      : { compiledRegistries: {}, usedBlocks: [] };

    const compiledEl = document.getElementById('jstwig-runtime-compiled');
    const usedEl = document.getElementById('jstwig-runtime-used');
    if (compiledEl) {
      compiledEl.textContent = JSON.stringify(snapshot.compiledRegistries || {}, null, 2);
    }
    if (usedEl) {
      usedEl.textContent = JSON.stringify(snapshot.usedBlocks || [], null, 2);
    }
  })();
</script>
HTML;
    }
}
