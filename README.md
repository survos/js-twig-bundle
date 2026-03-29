# JS Twig Bundle

Render Twig-like blocks in the browser from Stimulus controllers.

This bundle provides:
- A Symfony UX/TwigComponent bridge that extracts `<twig:block>` templates from Twig files.
- A browser-side twig.js API with Symfony-friendly helpers (`path`, `stimulus_*`, `ux_icon`, `render`).
- A block compiler/renderer utility for rendering a specific named block (for example a grid cell template in `api-grid-bundle`).
- A per-request manifest registry (block names + source hashes) for debug/discovery.
- An optional Dexie-based data/rendering pipeline.

## Why this exists

Server-rendered Twig is still the source of truth for markup, but some UI pieces need to be rendered client-side after async data is loaded. The primary use case is:
- define block templates in Twig
- pass those templates to JavaScript
- render specific blocks on demand from a Stimulus controller

## Current modules

- `assets/src/lib/twig_api.js`: installs Twig functions used by client-side templates.
- `assets/src/lib/twig_blocks.js`: compiles/renders named block registries.
- `src/TwigBlocksTrait.php`: extracts `<twig:block>` content from a caller template.
- `src/Components/JsTwigComponent.php` + `assets/src/controllers/js_twig_controller.js`: legacy UX component/controller path.
- `src/Components/DexieTwigComponent.php` + `assets/src/controllers/dexie_controller.js`: Dexie integration path.

## Recommended path for new work

For reusable rendering (for example, "render one cell block in a Stimulus grid controller"), prefer the library API:
- `installTwigAPI(...)`
- `compileTwigBlocks(registry, scriptTagId)`
- `twigRender(registry, blockName, data)`

This is more composable than hard-coding rendering logic in a single controller.

## Manifest + runtime debug

The bundle now emits two debug layers:

- **Server manifest registry** (per request): each component contributes a manifest id, caller template, slot names, and source hashes.
- **Runtime usage tracking** (browser): compiled registries and rendered block slots are captured in `window.__jstwigDebugSnapshot()`.

To show an on-page debug panel, enable bundle debug config and render:

```twig
{{ jstwig_debug_panel() }}
```

The panel shows:

- server manifest registry
- compiled registries on current page
- block slots rendered on current page

### 1) Emit blocks JSON from Twig

Use a script tag that contains a JSON object `blockName -> template string`.

```twig
{# Example: include this near the Stimulus root element #}
<script type="application/json" id="api-grid-cell-blocks" data-caller="{{ _self }}">
    {{ this.twigBlocks|json_encode|raw }}
</script>
```

`this.twigBlocks` comes from `TwigBlocksTrait` in a TwigComponent.

### 2) Compile and render in a Stimulus controller

```js
import { Controller } from '@hotwired/stimulus';
import { createEngine } from '@tacman1123/twig-browser';
import { installSymfonyTwigAPI } from '@tacman1123/twig-browser/adapters/symfony';
import { compileTwigBlocks } from '@tacman1123/twig-browser/src/compat/compileTwigBlocks.js';
import { path } from '@survos/js-twig/generated/fos_routes.js';

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

### 3) Define blocks in Twig

```twig
<twig:block name="cell">
    <span class="cell-label">{{ data.label }}</span>
</twig:block>
```

## Legacy `jsTwig` component usage

The bundle still ships `<twig:jsTwig>` and `js_twig_controller.js` for direct fetch-and-render flows, but new integrations should prefer the reusable block registry approach above.

## Twig functions available in browser templates

After `installSymfonyTwigAPI(...)`, twig.js templates can call:
- `path(route, params)`
- `render(blockName, vars)`
- `stimulus_controller(name, values, classes, outlets)`
- `stimulus_target(name, target)`
- `stimulus_action(name, action, event, params)`
- `ux_icon(name, attrs)`
- `sais_encode(url)`

Prefer `@tacman1123/twig-browser` directly for all new code. `assets/src/lib/twig_api.js` remains only as a legacy shim.

## Dexie integration (optional)

`<twig:dexie>` and `dexie_controller.js` support loading data into Dexie and rendering list/detail blocks. This is useful for offline/mobile-like patterns, but has a larger API surface and more coupling than the block registry flow.

If your goal is only "render Twig blocks from Stimulus", you usually do not need Dexie.

## Configuration (Dexie path)

Bundle configuration keys are defined in `src/SurvosJsTwigBundle.php`:
- `db`
- `version`
- `stores[]` with `name`, `schema`, `url`, `batch`, `response_key`

## AI/Human docs map

- `README.md`: entry point and quick usage.
- `docs/ARCHITECTURE.md`: internal contracts and data flow.
- `docs/AI_AGENT_GUIDE.md`: implementation conventions for contributors/agents.
- `docs/IMPROVEMENTS.md`: prioritized code improvements.
- `docs/EVENT_DRIVEN_EXAMPLE.md`: real-world event-driven rendering pattern.
