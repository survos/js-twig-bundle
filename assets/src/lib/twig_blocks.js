import { getRegistryEngine, twigDebugWrap } from './twig_api.js';

const DEBUG_STORE_KEY = '__jstwigRuntimeDebug';

function getDebugStore() {
    const store = globalThis[DEBUG_STORE_KEY] ?? {
        compiledRegistries: {},
        usedBlocks: [],
        compileErrors: {},
    };
    globalThis[DEBUG_STORE_KEY] = store;

    if (typeof globalThis.__jstwigDebugSnapshot !== 'function') {
        globalThis.__jstwigDebugSnapshot = () => ({
            compiledRegistries: { ...store.compiledRegistries },
            usedBlocks: [...store.usedBlocks],
            compileErrors: { ...store.compileErrors },
        });
    }

    if (typeof globalThis.__jstwigRegistryReport !== 'function') {
        globalThis.__jstwigRegistryReport = (scriptTagId = 'show-pages-blocks') => {
            const reg = store.compiledRegistries[scriptTagId] ?? null;
            const errs = store.compileErrors[scriptTagId] ?? {};
            const statuses = (reg?.blockNames ?? []).map((name) => ({
                name,
                status: errs[name] ? 'compile_error' : 'compiled',
                error: errs[name]?.message ?? null,
            }));

            return {
                scriptTagId,
                compiledAt: reg?.compiledAt ?? null,
                blockCount: statuses.length,
                statuses,
                manifest: reg?.manifest ?? null,
            };
        };
    }

    return store;
}

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function compileTwigBlocks(registry, scriptTagId = 'show-pages-blocks') {
    const debugStore = getDebugStore();
    registry.__errors__ = registry.__errors__ ?? {};
    registry.__sources__ = registry.__sources__ ?? {};
    registry.__payloads__ = registry.__payloads__ ?? {};
    registry.__meta__ = {
        ...(registry.__meta__ ?? {}),
        scriptTagId,
    };

    const escapedId = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
        ? CSS.escape(scriptTagId)
        : scriptTagId.replace(/(["\\#.:\[\],=])/g, '\\$1');
    const duplicateTags = document.querySelectorAll(`[data-jstwig-role="blocks"]#${escapedId}`);
    if (duplicateTags.length > 1) {
        throw new Error(
            `[twig_blocks] duplicate blocks script id "${scriptTagId}" found (${duplicateTags.length}). ` +
            'Each component instance must have a unique scriptTagId.'
        );
    }

    const el = document.getElementById(scriptTagId);
    if (!el) {
        console.warn(`[twig_blocks] <script id="${scriptTagId}"> not found.`);
        return registry;
    }

    let blocks;
    try {
        blocks = JSON.parse(el.textContent ?? '{}');
    } catch (error) {
        console.error(`[twig_blocks] failed to parse JSON from #${scriptTagId}`, error);
        return registry;
    }

    const engine = getRegistryEngine(registry);
    const blockNames = Object.keys(blocks);
    registry.__meta__.blockNames = blockNames;
    debugStore.compileErrors[scriptTagId] = {};

    for (const [name, payload] of Object.entries(blocks)) {
        const src = typeof payload === 'string' ? payload : (payload?.html ?? '');
        registry.__sources__[name] = src;
        registry.__payloads__[name] = payload;

        try {
            engine.compileBlock(name, src);
        } catch (error) {
            const message = error?.message ?? String(error);
            registry.__errors__[name] = {
                message,
                scriptTagId,
            };
            debugStore.compileErrors[scriptTagId][name] = {
                message,
                sourceSnippet: src.slice(0, 240),
            };
        }
    }

    const compileErrors = debugStore.compileErrors[scriptTagId];
    const failedNames = Object.keys(compileErrors);
    if (failedNames.length > 0) {
        console.error(`[twig_blocks] compile errors in #${scriptTagId}`, {
            scriptTagId,
            failedNames,
            compileErrors,
        });
    }

    const manifestTag = document.querySelector(`[data-jstwig-role="manifest"][data-jstwig-id="${scriptTagId}"]`);
    let manifest = null;
    if (manifestTag?.textContent) {
        try {
            manifest = JSON.parse(manifestTag.textContent);
        } catch {
            manifest = null;
        }
    }

    debugStore.compiledRegistries[scriptTagId] = {
        scriptTagId,
        blockNames,
        manifest,
        compiledAt: new Date().toISOString(),
    };

    return registry;
}

export function twigRender(registry, blockName, data = {}) {
    const debugStore = getDebugStore();
    const caller = data?.caller ?? data?.globals?.caller ?? null;
    const scriptTagId = registry.__meta__?.scriptTagId ?? 'unknown-script';

    if (registry.__errors__?.[blockName]) {
        const message = registry.__errors__[blockName]?.message ?? 'compile error';
        debugStore.usedBlocks.push({ scriptTagId, blockName, caller, status: 'compile_error', at: new Date().toISOString() });
        return `<div class="alert alert-danger p-1 small font-monospace">[twig compile error] ${esc(blockName)} @ #${esc(scriptTagId)}: ${esc(message)}</div>`;
    }

    if (!registry.__sources__?.[blockName]) {
        const available = Object.keys(registry.__sources__ ?? {}).join(', ');
        debugStore.usedBlocks.push({ scriptTagId, blockName, caller, status: 'missing_block', at: new Date().toISOString() });
        return `<div class="alert alert-danger p-1 small font-monospace">[twig missing block] ${esc(blockName)} @ #${esc(scriptTagId)}. Available: ${esc(available || '(none)')}</div>`;
    }

    try {
        const engine = getRegistryEngine(registry);
        const html = engine.renderBlock(blockName, data);
        debugStore.usedBlocks.push({ scriptTagId, blockName, caller, status: 'ok', at: new Date().toISOString() });
        return twigDebugWrap(blockName, html);
    } catch (error) {
        debugStore.usedBlocks.push({
            scriptTagId,
            blockName,
            caller,
            status: 'render_error',
            error: error?.message ?? String(error),
            at: new Date().toISOString(),
        });

        return `<div class="alert alert-danger p-1 small font-monospace">[twig render error] ${esc(blockName)} @ #${esc(scriptTagId)}: ${esc(error?.message ?? String(error))}</div>`;
    }
}
