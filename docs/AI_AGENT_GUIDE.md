# AI Agent Guide

## What to optimize for

- Keep Twig markup in Twig files, not JavaScript strings.
- Render named blocks from Stimulus controllers using the registry pattern.
- Prefer `assets/src/lib/twig_api.js` + `assets/src/lib/twig_blocks.js` over writing one-off Twig runtime glue.

## Canonical integration pattern

1. Use a TwigComponent that includes `TwigBlocksTrait`.
2. Emit block JSON in a `<script type="application/json" id="...">` tag.
3. In Stimulus `connect()`:
   - create `registry = {}`
   - call `installTwigAPI({ StimAttrs, Routing, blockRegistry: registry })`
   - call `compileTwigBlocks(registry, scriptTagId)`
4. Render with `twigRender(registry, blockName, data)`.

## Invariants to preserve

- Call `installTwigAPI()` before rendering block templates.
- Use the same registry object for API install and compile.
- Normalize twig.js `_keys` artifacts before passing params (already done in helpers).
- If using `path()`, ensure FOS JS routes data is loaded.

## Known twig.js differences from server Twig

- No Twig 3 `{% types %}` support.
- Arrow-function style filter expressions are not supported.
- Some filters may differ subtly; verify in browser.

## If you modify extraction/rendering

- Keep compatibility with block sources shaped as string or object-with-`html`.
- Do not remove visible render/compile error output unless replacing with equivalent diagnostics.
- Add examples to `README.md` when changing public integration flow.

## High-value cleanup targets

- Remove duplicated Twig runtime extension logic from legacy controllers.
- Move event wiring toward `CustomEvent` boundaries instead of outlet coupling.
- Reduce global mutable state (`window.db`, `window.app`) in Dexie path.
