# JS Twig Bundle

Write a Twig block once, render it on the server **and** in the browser.

`survos/js-twig-bundle` lets Stimulus controllers render `<twig:block>` templates
client-side, after async data arrives (API rows, Meilisearch hits, IndexedDB
records), with the same Symfony helpers you use on the server: `path()`,
`stimulus_*`, `ux_icon()`, `render()`. No Node, no bundler, no build step:
everything ships through AssetMapper and importmap.

Rendering is done by [twig-browser](https://github.com/tacman/twig-browser)
([`@tacman1123/twig-browser`](https://www.npmjs.com/package/@tacman1123/twig-browser)),
a browser-only Twig engine inspired by twig.js. It parses a focused Twig subset
in the browser, ships as source-first ESM, and fails fast on unsupported tags.

We use it in production for grid cells (`api-grid-bundle`), search results
(`meili-bundle`), trees (`tree-bundle`) and offline/mobile views (`mobile-bundle`).

## What you get

- **Twig blocks in the browser.** `TwigBlocksTrait` extracts `<twig:block>`
  sources from a TwigComponent's template and embeds them as JSON. A controller
  compiles them once and renders a named block per row or record.
- **Symfony helpers in client templates.** `path`, `render`, `stimulus_controller`,
  `stimulus_target`, `stimulus_action`, `ux_icon`, `sais_encode`, and a
  `markdown_to_html` filter.
- **`path()` without FOSJsRoutingBundle.** Exposed routes are written to
  `routes.json` during `cache:warmup` and loaded with AssetMapper's JSON import.
  No dump command, and no routing entry in your `importmap.php`. See
  [Routing](#routing-without-fosjsroutingbundle).
- **Debugging.** A per-request manifest of blocks (names and source hashes), a
  runtime snapshot of what was compiled and rendered, and an optional on-page
  debug panel.
- **Optional Dexie pipeline** for loading data into IndexedDB and rendering
  list/detail blocks offline.

## Requirements

- PHP 8.5, Symfony 7.4 or 8.1
- AssetMapper **7.4.20+ or 8.1.8+** (JSON imports, symfony/symfony#61133, with
  the es-module-shims loader fix, symfony/symfony#66282)
- `symfony/ux-twig-component`

```bash
composer require survos/js-twig-bundle
```

Flex adds `@tacman1123/twig-browser` (plus `marked` and `dexie`) to your importmap.

## Quick start

### 1) Define blocks in Twig

```twig
<twig:block name="cell">
    <a href="{{ path('product_show', {id: data.id}) }}">{{ data.label }}</a>
</twig:block>
```

### 2) Emit the blocks as JSON

`this.twigBlocks` comes from `TwigBlocksTrait` in a TwigComponent. The value is
a JSON object mapping each block name to its template source.

```twig
<script type="application/json" id="api-grid-cell-blocks" data-caller="{{ _self }}">
    {{ this.twigBlocks|json_encode|raw }}
</script>
```

### 3) Compile and render in a Stimulus controller

```js
import { Controller } from '@hotwired/stimulus';
import { createEngine } from '@tacman1123/twig-browser';
import { installSymfonyTwigAPI } from '@tacman1123/twig-browser/adapters/symfony';
import { compileTwigBlocks } from '@tacman1123/twig-browser/src/compat/compileTwigBlocks.js';
import { path } from '@survos/js-twig/routing';

export default class extends Controller {
  connect() {
    this.tpl = {};
    this.engine = createEngine();
    installSymfonyTwigAPI(this.engine, { pathGenerator: path });
    compileTwigBlocks(this.engine, this.tpl, 'api-grid-cell-blocks');
  }

  renderCell(row) {
    return this.engine.renderBlock('cell', { data: row, globals: { locale: 'en' } });
  }
}
```

## Twig functions available in browser templates

After `installSymfonyTwigAPI(...)`, client-side templates can call:
- `path(route, params)`
- `render(blockName, vars)`
- `stimulus_controller(name, values, classes, outlets)`
- `stimulus_target(name, target)`
- `stimulus_action(name, action, event, params)`
- `ux_icon(name, attrs)`
- `sais_encode(url)`

And the `markdown_to_html` filter (via [marked](https://www.npmjs.com/package/marked),
optional: without it the filter shows plain text and logs a notice):

```twig
{{ data.observation|markdown_to_html|raw }}
```

This mirrors the server-side `|markdown` filter (League\CommonMark), so prose
renders the same whether a block is rendered on the server or re-rendered in the
browser.

twig-browser supports a Twig subset: output, `if`/`elseif`/`else`, `for`, `set`,
and the common filters and tests. See its
[README](https://github.com/tacman/twig-browser#supported-twig-subset) for the
full list. Keep client-rendered blocks within it.

## Routing without FOSJsRoutingBundle

`cache:clear` / `cache:warmup` writes exposed route data to
`var/js_twig_bundle/generated/routes.json`. The bundle's static
`assets/routing.js` imports that JSON with AssetMapper's JSON import and exports
`path()` and `generate()`:

```js
import routesPromise from './routes.json';
const data = await routesPromise; // JSON imports resolve to a promise
```

In your code:

```js
import { path } from '@survos/js-twig/routing';

path('product_show', { id: 42 }); // "/product/42"
```

The bundle resolves this import and its JSON dependency automatically, including
when installed through a Composer path symlink. You don't need a routing entry
in the application's `importmap.php`, FOSJsRoutingBundle, or a dump command.

Expose routes with `options: ['expose' => true]` or configure
`survos_js_twig.routing.routes_to_expose`. Warm the cache before
`asset-map:compile` in production. Rewarm after changing exposed routes in development.

Migrating from the earlier generated-JS approach? The old
`@survos/js-twig/generated/fos_routes.js` import still works as an alias, but
old importmap entries pointing to a generated JS file must be removed. See the
[migration guide](docs/routing-migration.md).

## Manifest + runtime debug

- **Server manifest registry** (per request): each component contributes a
  manifest id, caller template, slot names and source hashes.
- **Runtime usage tracking** (browser): compiled registries and rendered block
  slots are captured in `window.__jstwigDebugSnapshot()`.

To show an on-page debug panel, enable bundle debug config and render:

```twig
{{ jstwig_debug_panel() }}
```

## Dexie integration (optional)

`<twig:dexie>` and `dexie_controller.js` load data into Dexie (IndexedDB) and
render list/detail blocks. This is useful for offline/mobile patterns, but has a
larger API surface than the block registry flow. If your goal is only "render
Twig blocks from Stimulus", you don't need Dexie.

Configuration keys (defined in `src/SurvosJsTwigBundle.php`): `db`, `version`,
and `stores[]` with `name`, `schema`, `url`, `batch`, `response_key`.

## Legacy APIs

- `<twig:jsTwig>` + `js_twig_controller.js`: direct fetch-and-render flow.
  Prefer the block registry approach above.
- `assets/src/lib/twig_api.js`: a shim kept for old callers. Use
  `@tacman1123/twig-browser` directly in new code.

## Docs

- `docs/ARCHITECTURE.md`: internal contracts and data flow.
- `docs/routing-migration.md`: moving off FOSJsRoutingBundle / generated JS routes.
- `docs/EVENT_DRIVEN_EXAMPLE.md`: a real-world event-driven rendering pattern.
- `docs/AI_AGENT_GUIDE.md`: conventions for contributors and agents.
- `docs/IMPROVEMENTS.md`: prioritized code improvements.

## License

MIT
