# AI Agent Guide

## What to optimize for

- Keep Twig markup in Twig files, not JavaScript strings.
- Use `@tacman1123/twig-browser` directly: `createEngine()`,
  `installSymfonyTwigAPI(engine, { pathGenerator: path })`,
  `engine.compileBlock(name, source)`, `engine.renderBlock(name, vars)`.
- Do not use the deprecated `assets/src/lib/twig_api.js` / `twig_blocks.js` in new code.

## Canonical integration pattern

1. Get Twig **source** into the browser: fetch a raw `.html.twig` from a route
   (search-bundle, meili-bundle), or embed `<twig:block>` markup in a
   `<script type="text/twig">` wrapped in `{% verbatim %}`.
2. In Stimulus `connect()`: `const { path } = await import('@survos/js-twig-bundle/routing')`,
   create the engine, install the Symfony adapter, compile once.
3. Render per record with `engine.renderBlock(name, { hit, ... })`.

Reference implementation: `search-bundle/assets/src/controllers/instantsearch_controller.js`
(live at https://searchbench.survos.com/search).

## Invariants to preserve

- Reference Survos bundle controllers in templates with `survos_stimulus('<pkg>-bundle', '<id>')`,
  never a hard-coded `@survos/...` string or `survos--...` identifier. In JS, derive
  attribute names from `this.identifier`.
- The routing import is `@survos/js-twig-bundle/routing`; it needs no importmap entry.
  Routes come from `routes.json`, written by `cache:warmup`.
- `compileTwigBlocks()` from twig-browser needs literal `<twig:block name="...">` markup;
  it does not accept the `TwigBlocksTrait` JSON map.

## Known twig-browser differences from server Twig

twig-browser implements a subset (see its README). Unsupported tags fail at compile time.
In particular:

- No `{% types %}`, macros, `include`/`extends`/`embed`.
- Arrow-function filter arguments are not supported.
- Some filters differ subtly (e.g. `date` formatting); verify in the browser.

## If you modify extraction/rendering

- The legacy registry accepts block sources shaped as string or object-with-`html`; keep that if you touch it.
- Do not remove visible render/compile error output unless replacing with equivalent diagnostics.
- Add examples to `README.md` when changing public integration flow.

## High-value cleanup targets

- Fix or remove `<twig:jsTwig>` / `js_twig_controller.js` (broken: see README).
- Remove the deprecated `twig_api.js` / `twig_blocks.js` shims once nothing imports them.
- Move event wiring toward `CustomEvent` boundaries instead of outlet coupling.
- Reduce global mutable state (`window.db`, `window.app`) in Dexie path.
