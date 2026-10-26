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
This bundle supplies the Symfony side: the AssetMapper wiring and the `markdown_to_html`
filter. `path()` comes from [symfony/ux-router](https://symfony.com/bundles/ux-router/current/index.html).

**Live demo:** [searchbench.survos.com/search](https://searchbench.survos.com/search).
Every search hit there is a Twig template rendered in the browser. The reference
implementation is `search-bundle`'s
[`instantsearch_controller.js`](../search-bundle/assets/src/controllers/instantsearch_controller.js).
The same pattern runs in `meili-bundle` (insta search, chat), `api-grid-bundle`
(grid cells, modals) and `tree-bundle` (node labels).

## What you get

- **Twig in the browser.** Compile a Twig source string once, then render it
  for each row or hit as data arrives.
- **Symfony helpers in client templates.** `path()` and `ux_icon()` come from
  the Symfony adapter. `stimulus_controller`, `stimulus_target`,
  `stimulus_action` and `render` are built into twig-browser. A
  `markdown_to_html` filter is available from this bundle.
- **`path()` from symfony/ux-router.** The app's `assets/router.js` generates the same
  URLs as Symfony's `UrlGenerator`. See [Routing](#routing).

## Requirements

- PHP 8.5, Symfony 7.4 or 8.1
- `symfony/ux-router` ^3.6 (browser `path()`; see [Routing](#routing))
- `symfony/ux-twig-component`

```bash
composer require survos/js-twig-bundle
```

Flex adds `@tacman1123/twig-browser` and its Symfony adapter (plus `marked` and
`dexie`) to your importmap.

## Quick start

The pattern is always the same: get Twig **source** (not rendered HTML) into
the browser, `compileBlock()` it once, then `renderBlock()` it with data.

### A) Fetch a template from a URL

This is what searchbench does. Serve the raw, unrendered `.html.twig` file from
a route (for example `meili-bundle`'s `meili_template` route returns
`file_get_contents()` of the template):

```twig
{# templates/js/movie.html.twig, served as text, never rendered on the server #}
<article class="hit">
    <a href="{{ path('movie_show', {id: hit.id}) }}">{{ hit.title }}</a>
    {% if hit.year %}<span class="text-secondary">{{ hit.year }}</span>{% endif %}
</article>
```

```js
import { Controller } from '@hotwired/stimulus';
import { createEngine } from '@tacman1123/twig-browser';
import { installSymfonyTwigAPI } from '@tacman1123/twig-browser/adapters/symfony';
import { path } from 'router'; // the app's assets/router.js

export default class extends Controller {
    static values = { template: String };

    async connect() {
        const source = await (await fetch(this.templateValue)).text();
        this.engine = createEngine();
        installSymfonyTwigAPI(this.engine, { pathGenerator: path });
        this.engine.compileBlock('hit', source);
    }

    renderHit(hit) {
        return this.engine.renderBlock('hit', { hit });
    }
}
```

Mount it like any app controller (here `assets/controllers/hits_controller.js`):

```twig
<div {{ stimulus_controller('hits', {
    template: path('meili_template', {templateName: 'movie'}),
}) }}></div>
```

Controllers that ship in a Survos bundle are always referenced through the kit
helper, never by a hard-coded name: `stimulus_controller(survos_stimulus('search-bundle', 'instantsearch'))`.
The helper fails loudly in dev when a name changes; a hard-coded string just
silently stops mounting.

### B) Inline blocks in the page

When the template belongs with the page, put one or more `<twig:block>`
sources in a `<script type="text/twig">` element and compile them all with
`compileTwigBlocks(engine, registry, elementId)`. It reads the element's
`innerHTML`; a script element keeps that as raw text (a `<template>` would let
the HTML parser drop table tags). Wrap the blocks in `{% verbatim %}` so the
server doesn't render them:

```twig
<script type="text/twig" id="row-blocks">{% verbatim %}
    <twig:block name="row">
        <tr><td>{{ row.name }}</td><td>{{ row.count|number_format }}</td></tr>
    </twig:block>
{% endverbatim %}</script>
```

```js
import { createEngine, compileTwigBlocks } from '@tacman1123/twig-browser';

const engine = createEngine();
const blocks = {};
compileTwigBlocks(engine, blocks, 'row-blocks'); // blocks.row === true
tbody.innerHTML = rows.map((row) => engine.renderBlock('row', { row })).join('');
```

`compileTwigBlocks()` only finds literal `<twig:block name="…">` markup; it
throws when none is present.

## Twig functions available in browser templates

| Name | Provided by |
| --- | --- |
| `path(route, params)` | `installSymfonyTwigAPI(engine, { pathGenerator: path })` |
| `ux_icon(name, attrs)` | `installSymfonyTwigAPI(engine, { uxIconResolver })`, or `window.__survosIconsMap` (`bin/console ux:icons:lock`) |
| `stimulus_controller`, `stimulus_target`, `stimulus_action` | built into twig-browser |
| `render(blockName, vars)` | built into twig-browser |
| `markdown_to_html` filter | `installMarkdownFilter(engine)` from this bundle |

```js
import { installMarkdownFilter } from '@survos/js-twig-bundle/src/lib/markdown_filter.js';

installMarkdownFilter(engine);
```

```twig
{{ hit.observation|markdown_to_html|raw }}
```

The filter uses [marked](https://www.npmjs.com/package/marked). It is optional:
without `marked` in the importmap the filter shows plain text and logs a notice.
It mirrors the server-side `|markdown` filter (League\CommonMark), so prose
renders the same on the server and in the browser.

twig-browser supports a Twig subset: output, `if`/`elseif`/`else`, `for`, `set`,
and the common filters and tests. See its
[README](https://github.com/tacman/twig-browser#supported-twig-subset) for the
full list. Keep client-rendered templates within it.

## Routing

Browser `path()` is generated by [symfony/ux-router](https://symfony.com/bundles/ux-router/current/index.html),
which returns the same URLs as Symfony's `path()` and `url()`. This bundle no longer ships a route
generator (it used to, as `@survos/js-twig-bundle/routing`).

```bash
composer require symfony/ux-router
```

Flex creates `assets/router.js`. Map it in `importmap.php` so bundles can import it by name, and make
sure the dump directory exists before the first `cache:clear` (ux-router's cache warmer is only optional
once `var/routes` exists; on a fresh build it runs before Doctrine's and fails):

```php
'router' => ['path' => './assets/router.js'],
```

```json
"scripts": { "pre-install-cmd": "mkdir -p var/routes", "pre-update-cmd": "mkdir -p var/routes" }
```

Expose the routes your client templates call, with `options: ['expose' => true]` or
`ux_router.routes` patterns (`'app_*'`, `'!app_admin_*'`). In your code:

```js
import { path } from 'router';

path('product_show', { id: 42 });                        // "/product/42"
path('about', { q: 'a b' });                             // "/about?q=a%20b"
engine = createEngine();
installSymfonyTwigAPI(engine, { pathGenerator: path });  // path() inside client Twig
```

The Survos bundles (`api-grid`, `tree`, `search`, `meili`, `folio`) import `router` themselves.

Migrating from this bundle's old routing: replace `@survos/js-twig-bundle/routing` (and the earlier
`@survos/js-twig/routing`) with `router`, move `survos_js_twig.routing.routes_to_expose` regexes to
`ux_router.routes` globs, and delete any importmap entry for `fos_routes.js`. The `routing` key still
parses but does nothing and is deprecated.

## Legacy APIs

These predate twig-browser's `compileBlock()` API. They are kept for existing
callers and are not recommended for new code.

- **`TwigBlocksTrait` + `<twig:jsTwig>` + `js_twig_controller.js`.** The trait
  extracts `<twig:block>` contents from a component template into a JSON map
  (`{name: {html, wrapper, extra}}`) in a `<script type="application/json">` tag.
  Two compilers accept that JSON: the deprecated `compileTwigBlocks(registry, id)`
  in `assets/src/lib/twig_blocks.js`, and `tree-bundle`'s
  `sourceFromScriptContent()` (in `api_tree_controller.js`), which turns it back
  into `<twig:block>` markup. `js_twig_controller.js` does neither: it passes
  the JSON tag's id to twig-browser's `compileTwigBlocks()`, which needs literal
  `<twig:block>` markup and throws "No `<twig:block name=…>` tags were found".
  **`<twig:jsTwig>` is broken as shipped**; don't build on it.
- **`<twig:dexie>` + `dexie_controller.js`.** Loads API data into Dexie
  (IndexedDB) and renders list/detail blocks with `compileBlock()`. Used for
  offline/mobile experiments. Configuration keys (in `src/SurvosJsTwigBundle.php`):
  `db`, `version`, and `stores[]` with `name`, `schema`, `url`, `batch`,
  `response_key`. `mobile-bundle` uses its `DbUtilities`
  (`assets/src/lib/dexieDatabase.js`).
- **`assets/src/lib/twig_api.js` / `twig_blocks.js`.** Deprecated shims
  (`installTwigAPI()` logs a deprecation error; `compileTwigBlocks(registry, id)`,
  `twigRender()`). Nothing in the Survos bundles uses them any more. Use
  `@tacman1123/twig-browser` directly.
- **Debug manifest.** `{{ jstwig_debug_panel() }}` and
  `window.__jstwigDebugSnapshot()` only see blocks that go through the legacy
  component and `twig_blocks.js`, not the `compileBlock()` flow above.

## Docs

- `docs/ARCHITECTURE.md`: data flow, including the legacy block-registry path.
- `docs/EVENT_DRIVEN_EXAMPLE.md`: a real-world event-driven rendering pattern.
- `docs/AI_AGENT_GUIDE.md`: conventions for contributors and agents.
- `docs/IMPROVEMENTS.md`: prioritized code improvements.

## License

MIT
