/**
 * @survos/js-twig-bundle — twig_blocks.js
 *
 * Reusable helpers for compiling and rendering named twig.js block registries.
 *
 * The contract between PHP and JS:
 *   - PHP (ShowPagesComponent / any TwigBlocksInterface component) emits a
 *     <script type="application/json" id="<scriptTagId>"> tag whose text content
 *     is a JSON object mapping block name → raw Twig source string.
 *   - compileTwigBlocks() reads that tag, compiles each source with twig.js, and
 *     stores the compiled templates in the provided registry object.
 *   - twigRender() looks up a compiled template and renders it, surfacing any
 *     error as a visible inline alert rather than swallowing it silently.
 *
 * Usage in a Stimulus controller:
 *
 *   import { compileTwigBlocks, twigRender } from '@survos/js-twig-bundle/twig_blocks';
 *   import { installTwigAPI } from '@survos/js-twig-bundle/twig_api';
 *
 *   connect() {
 *     this._tpl = {};
 *     // installTwigAPI must receive the registry reference BEFORE compileTwigBlocks
 *     // fills it, so render() can resolve blocks at call time.
 *     installTwigAPI({ Routing, StimAttrs, blockRegistry: this._tpl });
 *     compileTwigBlocks(this._tpl, 'show-pages-blocks');
 *   }
 *
 *   // Render a block — always returns a string (error banner on failure).
 *   someTarget.innerHTML = twigRender(this._tpl, 'thumbList', { images });
 *
 * Nesting / composition:
 *   Once installTwigAPI has been called with blockRegistry: this._tpl, any
 *   twig block can call sibling blocks via the render() twig function:
 *
 *   {# thumbList block #}
 *   {% for img in images %}{{ render('thumbTile', {img: img}) }}{% endfor %}
 *
 *   {# thumbTile block #}
 *   <div class="ss-img-tile">
 *     {{ render('imageThumbnail', {img: img}) }}
 *     <div class="ss-footer">{{ img.orderIdx }}</div>
 *   </div>
 */

import Twig from 'twig';
import { twigDebugWrap } from './twig_api.js';

/**
 * Read the block JSON from a <script type="application/json"> tag, compile
 * each block with twig.js, and store the results in `registry`.
 *
 * Compile errors are stored under `registry.__errors__[blockName]` so
 * twigRender() can surface them visibly without re-parsing.
 *
 * @param {object} registry     Plain object to populate (passed by reference).
 * @param {string} scriptTagId  id= of the <script> tag emitted by the PHP component.
 *                              Defaults to 'show-pages-blocks'.
 * @returns {object}  The same registry object (for chaining / inspection).
 */
export function compileTwigBlocks(registry, scriptTagId = 'show-pages-blocks') {
    registry.__errors__ = registry.__errors__ ?? {};

    const el = document.getElementById(scriptTagId);
    if (!el) {
        console.warn(`[twig_blocks] <script id="${scriptTagId}"> not found — no blocks compiled`);
        return registry;
    }

    let blocks;
    try {
        blocks = JSON.parse(el.textContent);
    } catch (e) {
        console.error(`[twig_blocks] failed to parse JSON from #${scriptTagId}:`, e);
        return registry;
    }

    for (const [name, source] of Object.entries(blocks)) {
        const src = typeof source === 'string' ? source : (source.html ?? '');
        try {
            registry[name] = Twig.twig({ data: src, rethrow: true });
        } catch (e) {
            console.error(`[twig_blocks] compile error in block "${name}":`, e);
            registry.__errors__[name] = e.message ?? String(e);
        }
    }

    return registry;
}

/**
 * Render a named block from the registry with the given data.
 * Always returns a string — errors surface as visible inline alerts.
 *
 * @param {object} registry   Populated by compileTwigBlocks().
 * @param {string} blockName  Key in the registry.
 * @param {object} data       Variables passed to the template.
 * @returns {string}          Rendered HTML (or an error banner).
 */
export function twigRender(registry, blockName, data = {}) {
    // Compile-time error recorded earlier
    if (registry.__errors__?.[blockName]) {
        return `<div class="alert alert-danger p-1 small font-monospace">` +
            `[twig compile error] ${_esc(blockName)}: ${_esc(registry.__errors__[blockName])}` +
            `</div>`;
    }

    const tpl = registry[blockName];
    if (!tpl || typeof tpl.render !== 'function') {
        return `<div class="alert alert-warning p-1 small font-monospace">` +
            `[twig] block not found: ${_esc(blockName)}` +
            `</div>`;
    }

    try {
        const html = tpl.render({ ...data, _keys: null });
        return twigDebugWrap(blockName, html);
    } catch (e) {
        console.error(`[twig_blocks] render error in block "${blockName}":`, e);
        return `<div class="alert alert-danger p-1 small font-monospace">` +
            `[twig render error] ${_esc(blockName)}: ${_esc(e.message ?? String(e))}` +
            `</div>`;
    }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
