import { createEngine } from '@tacman1123/twig-browser';
import { installSymfonyTwigAPI } from '@tacman1123/twig-browser/adapters/symfony';

export const TWIG_DEBUG = true;

const INSTALL_SEQ_KEY = '__jstwigInstallSeq__';

function ensureRegistryShape(blockRegistry) {
    if (!blockRegistry || typeof blockRegistry !== 'object') {
        throw new Error('[twig_api] installTwigAPI requires blockRegistry object reference.');
    }

    blockRegistry.__errors__ = blockRegistry.__errors__ ?? {};
    blockRegistry.__sources__ = blockRegistry.__sources__ ?? {};
    blockRegistry.__meta__ = blockRegistry.__meta__ ?? {};
    return blockRegistry;
}

export function twigDebugWrap(blockName, html) {
    if (!TWIG_DEBUG) {
        return html;
    }

    const slug = String(blockName).replace(/[^a-zA-Z0-9_-]/g, '-');
    const classes = `jstwig-block jstwig-block-${slug}`;
    const tagRe = /^(\s*<\w+)([^>]*)/;

    return String(html).replace(tagRe, (_, tag, attrs) => {
        if (/\bclass\s*=\s*"/.test(attrs)) {
            return tag + attrs.replace(/\bclass\s*=\s*"/, `class="${classes} `);
        }
        if (/\bclass\s*=\s*'/.test(attrs)) {
            return tag + attrs.replace(/\bclass\s*=\s*'/, `class='${classes} `);
        }
        return `${tag}${attrs} class="${classes}"`;
    });
}

export function installTwigAPI({ Routing = null, StimAttrs = null, blockRegistry = {}, pathGenerator = null, uxIconResolver = null } = {}) {
    if (!globalThis.__jstwigDeprecatedInstallWarned__) {
        console.warn('[js-twig-bundle] installTwigAPI() is deprecated. Migrate to @tacman1123/twig-browser createEngine() + installSymfonyTwigAPI().');
        globalThis.__jstwigDeprecatedInstallWarned__ = true;
    }

    const registry = ensureRegistryShape(blockRegistry);

    const installSeq = (globalThis[INSTALL_SEQ_KEY] = (globalThis[INSTALL_SEQ_KEY] ?? 0) + 1);
    const resolvePath = typeof pathGenerator === 'function'
        ? pathGenerator
        : Routing && typeof Routing.generate === 'function'
            ? (route, routeParams = {}) => {
                const safeParams = { ...(routeParams ?? {}) };
                delete safeParams._keys;
                return Routing.generate(route, safeParams);
            }
            : null;

    const resolveIcon = typeof uxIconResolver === 'function'
        ? uxIconResolver
        : (name, attrs = {}) => {
            const map = globalThis.__survosIconsMap || {};
            const svg = map[name];
            if (!svg) {
                return `<span title="icon:${name}">□</span>`;
            }
            if (attrs?.class) {
                return `<span class="${String(attrs.class)}">${svg}</span>`;
            }
            return svg;
        };

    const engine = createEngine({
        pathGenerator: resolvePath,
        uxIconResolver: resolveIcon,
    });

    installSymfonyTwigAPI(engine, {
        Routing,
        pathGenerator: resolvePath,
        uxIconResolver: resolveIcon,
    });

    registry.__engine__ = engine;
    registry.__meta__.installSeq = installSeq;
    registry.__meta__.hasRouting = !!resolvePath;
    registry.__meta__.hasStimAttrs = !!StimAttrs;
    registry.__meta__.installedAt = new Date().toISOString();

    globalThis.__jstwigLastInstall__ = {
        installSeq,
        hasRouting: !!resolvePath,
        hasStimAttrs: !!StimAttrs,
    };

    return engine;
}

export function getRegistryEngine(blockRegistry) {
    const registry = ensureRegistryShape(blockRegistry);
    if (!registry.__engine__) {
        registry.__engine__ = createEngine();
    }
    return registry.__engine__;
}
