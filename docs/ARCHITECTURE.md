# Architecture

> **Current flow (2026):** controllers create a twig-browser engine
> (`createEngine()` + `installSymfonyTwigAPI(engine, { pathGenerator: path })`),
> call `engine.compileBlock(name, source)` with Twig source fetched from a URL or
> read from the page, and `engine.renderBlock(name, vars)` per record. `path`
> comes from `@survos/js-twig-bundle/routing` (see `docs/routing-migration.md`).
> Reference: `search-bundle/assets/src/controllers/instantsearch_controller.js`.
>
> The rest of this document describes the **legacy block-registry path**
> (`TwigBlocksTrait` JSON + `twig_api.js`/`twig_blocks.js`). It is kept for
> existing callers; see the README's "Legacy APIs" for its status.

## Goal

Render Twig-authored block templates in the browser via Stimulus controllers.

## Core contract

1. PHP/Twig extracts block source strings from a caller template.
2. Those blocks are serialized to JSON and embedded in the page.
3. JavaScript compiles each source with twig-browser (`engine.compileBlock()`).
4. Controllers render a named block with runtime data.

## Manifest layer

In addition to raw block JSON, each component can expose a manifest entry:

- `manifestId` (script tag id / logical registry id)
- `caller` template path
- slot list (`name`, `sourceHash`, optional wrapper metadata)

This enables runtime discovery and easier debugging of which slots are available.

## Main building blocks

- `src/TwigBlocksTrait.php`
  - Reads a Twig source file (`caller`) and extracts `<twig:block ...>` nodes.
  - Returns a map keyed by block name.
- `assets/src/lib/twig_blocks.js`
  - `compileTwigBlocks(registry, scriptTagId)` compiles block source with twig-browser (deprecated shim).
  - `twigRender(registry, blockName, data)` renders one block and returns HTML.
- `assets/src/lib/twig_api.js`
  - Deprecated shim: wires `path` and `ux_icon` into a twig-browser engine (`installTwigAPI()`). New code uses `installSymfonyTwigAPI()`.

## Data shapes

`TwigBlocksTrait::getTwigBlocks()` returns block values in this shape:

```json
{
  "cell": {
    "extra": " ...attributes from node...",
    "wrapper": null,
    "html": "<span>{{ data.label }}</span>"
  }
}
```

`compileTwigBlocks()` accepts either:
- direct string values (`"cell": "...twig..."`), or
- object values containing `.html` (`"cell": {"html": "...twig..."}`).

This keeps compatibility between current PHP extraction and JS compilation.

## Rendering lifecycle

1. Controller creates a registry object (`this.tpl = {}`).
2. Controller installs API: `installTwigAPI({ StimAttrs, Routing, blockRegistry: this.tpl })`.
3. Controller compiles blocks from JSON script tag: `compileTwigBlocks(this.tpl, 'some-id')`.
4. Controller renders specific blocks: `twigRender(this.tpl, 'cell', { data, globals })`.

## Error behavior

- Compile errors are captured per block in `registry.__errors__`.
- Render errors return visible inline HTML alerts instead of failing silently.
- Missing blocks return inline warning HTML.

This is intentional to make migration/debugging visible in UI.

## Debug surfaces

- `jstwig_manifest_registry()` (Twig function): server-side manifest map for current request.
- `jstwig_debug_panel()` (Twig function): floating on-page debug panel.
- `window.__jstwigDebugSnapshot()` (browser): runtime compiled registries + used block slots.

## Legacy and optional paths

- `js_twig_controller.js` and `<twig:jsTwig>` are legacy convenience wrappers.
- `dexie_controller.js` and `<twig:dexie>` add offline/event-driven data workflows.

For new integrations use twig-browser directly (`compileBlock`/`renderBlock`), as `api-grid-bundle`, `search-bundle`, `meili-bundle` and `tree-bundle` do. `<twig:jsTwig>` is broken as shipped (see README).
