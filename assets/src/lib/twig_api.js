/**
 * @survos/js-twig-bundle — twig_api.js
 *
 * Installs Symfony/Stimulus helper functions into twig.js so that blocks
 * compiled client-side can use the same functions available in server-side
 * Twig templates.
 *
 * Also provides:
 *   - TWIG_DEBUG / twigDebugWrap()  — visible dashed-border overlay per block
 *   - render(blockName, vars)       — call a sibling block from inside a template
 *
 * Usage in a Stimulus controller:
 *
 *   import { installTwigAPI, twigDebugWrap, TWIG_DEBUG } from '@survos/js-twig-bundle/twig_api';
 *   import * as StimAttrs from 'stimulus-attributes';
 *
 *   // Optional — load FOS Routing if available
 *   let Routing = null;
 *   try {
 *     const mod = await import('fos-routing');
 *     Routing = mod.default;
 *     const data = await import('/js/fos_js_routes.js');
 *     Routing.setData(data.default);
 *   } catch { }
 *
 *   // Registry is a plain object — pass it before filling it.
 *   // render() closes over the reference; compileTwigBlocks fills it later.
 *   this._tpl = {};
 *   installTwigAPI({ Routing, StimAttrs, blockRegistry: this._tpl });
 *
 * Known twig.js 1.x limitations (vs server-side Twig):
 *   - Arrow-function filters are NOT supported: images|filter(i => i.isCover) will fail.
 *     Use {% for i in images %}{% if i.isCover %}{% set x = x|merge([i]) %}{% endif %}{% endfor %}
 *   - {% types %} is not supported (Twig 3.x feature).
 *   - Some string/array filters may behave differently; test in the browser.
 *
 * After calling installTwigAPI(), every twig.js template in this module can use:
 *
 *   {{ path('route_name', {param: value}) }}
 *   {{ render('blockName', {var: value}) }}   ← call a sibling block by name
 *   {{ stimulus_controller('my-ctrl', {url: '...'}) }}
 *   {{ stimulus_target('my-ctrl', 'myTarget') }}
 *   {{ stimulus_action('my-ctrl', 'myAction') }}
 *   {{ stimulus_action('my-ctrl', 'myAction', 'click') }}
 *   {{ ux_icon('mdi:pencil') }}
 *   {{ ux_icon('mdi:pencil', {class: 'text-primary'}) }}
 *   {{ sais_encode(url) }}
 */

import Twig from 'twig';

// ── Debug classes ─────────────────────────────────────────────────────────────

/**
 * When true, twigDebugWrap() stamps two CSS classes onto the outermost element
 * of every top-level twig.js render:
 *
 *   jstwig-block            — present on every twig-rendered element
 *   jstwig-block-<name>     — specific to the block, e.g. jstwig-block-imageTile
 *
 * You can then target them in DevTools or your own stylesheet, e.g.:
 *
 *   .jstwig-block { background: rgba(99,102,241,.08); }
 *   .jstwig-block-imageGrid { outline: 1px solid red; }
 *
 * Flip to false (or remove) once the migration is complete.
 */
export const TWIG_DEBUG = true;

/**
 * Stamp jstwig-block classes onto the first element of rendered HTML.
 * No-op when TWIG_DEBUG is false.
 *
 * @param {string} blockName
 * @param {string} html
 * @returns {string}
 */
export function twigDebugWrap(blockName, html) {
    if (!TWIG_DEBUG) return html;

    const slugName = blockName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const newClasses = `jstwig-block jstwig-block-${slugName}`;

    // Match the opening tag of the first element, handling quoted attribute
    // values that may contain '>' (e.g. data-action="click->ctrl#action").
    const tagRe = /^(\s*<\w+)((?:\s+(?:[a-zA-Z_:][^\s"'>\/=]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'`=<>]+))?))*)/;
    return html.replace(tagRe, (_, tag, attrs) => {
        // Append to an existing class="..." value, or add a new class attribute.
        if (/\bclass\s*=\s*"/.test(attrs)) {
            return tag + attrs.replace(/\bclass\s*=\s*"/, `class="${newClasses} `);
        }
        if (/\bclass\s*=\s*'/.test(attrs)) {
            return tag + attrs.replace(/\bclass\s*=\s*'/, `class='${newClasses} `);
        }
        return tag + attrs + ` class="${newClasses}"`;
    });
}

// ── installTwigAPI ───────────────────────────────────────────────────────────

/**
 * @param {object}      options
 * @param {object|null} options.Routing       FOS JS Routing instance (optional).
 * @param {object}      options.StimAttrs     stimulus-attributes module (required).
 * @param {object}      [options.blockRegistry={}]
 *   A plain object that will be populated by compileTwigBlocks() with compiled
 *   twig.js templates keyed by block name.  Pass the same reference here and to
 *   compileTwigBlocks() so the render() twig function can resolve sibling blocks
 *   at call time (after compilation is complete).
 */
export function installTwigAPI({ Routing = null, StimAttrs, blockRegistry = {} }) {
    Twig.extend((TwigApi) => {

        // ── render(blockName, vars) ──────────────────────────────────────────
        // Call a sibling twig block by name from inside a template.
        // Enables nested/composable blocks without file-path references.
        //
        // Example in a thumbList block:
        //   {% for img in images %}{{ render('thumbTile', {img: img}) }}{% endfor %}
        //
        // Example in a thumbTile block:
        //   <div class="ss-img-tile">
        //     {{ render('imageThumbnail', {img: img}) }}
        //     <div class="ss-footer">{{ img.orderIdx }}</div>
        //   </div>
        TwigApi._function.extend('render', (blockName, vars = {}) => {
            if (vars && typeof vars === 'object' && '_keys' in vars) delete vars._keys;
            const tpl = blockRegistry[blockName];
            if (!tpl) {
                console.warn(`[twig_api] render('${blockName}') — block not found in registry`);
                return `<div class="alert alert-warning p-1 small font-monospace">[twig] block not found: ${blockName}</div>`;
            }
            try {
                // No twigDebugWrap here — debug labels are applied only by twigRender()
                // (the top-level JS entry point) so nested render() calls don't produce
                // labels that visually obscure their parent block's label.
                return tpl.render({ ...vars, _keys: null });
            } catch (e) {
                console.error(`[twig_api] render('${blockName}') error:`, e);
                return `<div class="alert alert-danger p-1 small font-monospace">[twig render error] ${blockName}: ${e.message ?? String(e)}</div>`;
            }
        });

        // ── path() ──────────────────────────────────────────────────────────
        // Mirrors Symfony's path() Twig function.
        // Requires FOS JS Routing bundle with options: ['expose' => true] on #[Route].
        TwigApi._function.extend('path', (route, routeParams = {}) => {
            if (!Routing) {
                console.warn(`[twig_api] path('${route}') called but FOS Routing is not available.`);
                return `#missing-routing(${String(route)})`;
            }
            if (routeParams && typeof routeParams === 'object' && '_keys' in routeParams) {
                delete routeParams._keys;
            }
            try {
                return Routing.generate(route, routeParams);
            } catch (e) {
                console.warn(`[twig_api] path('${route}') failed:`, e.message);
                return `#route-error(${String(route)})`;
            }
        });

        // ── stimulus_controller() ────────────────────────────────────────────
        TwigApi._function.extend('stimulus_controller', (name, values = {}, classes = {}, outlets = {}) => {
            if (values  && typeof values  === 'object' && '_keys' in values)  delete values._keys;
            if (classes && typeof classes === 'object' && '_keys' in classes) delete classes._keys;
            if (outlets && typeof outlets === 'object' && '_keys' in outlets) delete outlets._keys;
            return StimAttrs.stimulus_controller(name, values, classes, outlets);
        });

        // ── stimulus_target() ────────────────────────────────────────────────
        TwigApi._function.extend('stimulus_target', (name, target = null) => {
            return StimAttrs.stimulus_target(name, target);
        });

        // ── stimulus_action() ────────────────────────────────────────────────
        TwigApi._function.extend('stimulus_action', (name, action, event = null, params = {}) => {
            if (params && typeof params === 'object' && '_keys' in params) delete params._keys;
            return StimAttrs.stimulus_action(name, action, event, params);
        });

        // ── ux_icon() ────────────────────────────────────────────────────────
        // Renders an SVG icon from the server-injected map:
        //   window.__survosIconsMap = { 'mdi:pencil': '<svg>...</svg>' }
        TwigApi._function.extend('ux_icon', (name, attrs = {}) => {
            if (!name) return '';
            if (attrs && typeof attrs === 'object' && '_keys' in attrs) delete attrs._keys;
            const map = window.__survosIconsMap || {};
            const svg = map[name];
            if (!svg) {
                console.warn(`[twig_api] ux_icon('${name}') not found in icon map`);
                return `<span title="icon:${name}">□</span>`;
            }
            if (attrs?.class) {
                return `<span class="${String(attrs.class)}">${svg}</span>`;
            }
            return svg;
        });

        // ── sais_encode() ────────────────────────────────────────────────────
        // URL-safe base64 encode for passing asset URLs in routes.
        TwigApi._function.extend('sais_encode', (url) => {
            return btoa(String(url ?? ''))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        });
    });
}
