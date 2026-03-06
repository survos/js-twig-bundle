import { Controller } from '@hotwired/stimulus';
import * as StimAttrs from 'stimulus-attributes';
import { installTwigAPI } from '../lib/twig_api.js';
import { compileTwigBlocks, twigRender } from '../lib/twig_blocks.js';

let Routing = null;
try {
    const mod = await import('fos-routing');
    Routing = mod.default;

    let routingLoaded = false;
    try {
        const response = await fetch('/js/fos_js_routes.json', {
            headers: { Accept: 'application/json' },
        });
        if (response.ok) {
            Routing.setData(await response.json());
            routingLoaded = true;
        }
    } catch {
        routingLoaded = false;
    }

    if (!routingLoaded) {
        const data = await import('/js/fos_js_routes.js');
        Routing.setData(data.default);
    }
} catch {
    // optional in non-Symfony/FOS contexts
}

/* stimulusFetch: 'lazy' */
export default class extends Controller {
    static targets = ['message'];

    static values = {
        blocks: { type: Object, default: {} },
        data: { type: String, default: '{}' },
        globals: { type: String, default: '{}' },
        apiUrl: { type: String, default: '' },
        searchPanesDataUrl: { type: String, default: '' },
        scriptTagId: { type: String, default: '' },
    };

    connect() {
        this._tpl = {};
        installTwigAPI({ Routing, StimAttrs, blockRegistry: this._tpl });

        if (this.scriptTagIdValue) {
            compileTwigBlocks(this._tpl, this.scriptTagIdValue);
        }

        this.render();
    }

    async fetchItem() {
        if (!this.apiUrlValue) {
            return JSON.parse(this.dataValue || '{}');
        }

        const response = await fetch(this.apiUrlValue);
        if (!response.ok) {
            throw new Error(`An error has occurred: ${response.status}`);
        }

        return response.json();
    }

    async render() {
        const globals = JSON.parse(this.globalsValue || '{}');
        const item = await this.fetchItem();

        const blockName = this.pickDefaultBlockName();
        const html = twigRender(this._tpl, blockName, {
            data: item,
            row: item,
            globals,
            caller: this.identifier,
        });

        this.element.innerHTML = html;
    }

    pickDefaultBlockName() {
        const names = Object.keys(this._tpl).filter((name) => !name.startsWith('__'));
        if (names.length === 0) {
            throw new Error(`No Twig blocks compiled for scriptTagId='${this.scriptTagIdValue}'.`);
        }

        if (names.includes('content')) {
            return 'content';
        }

        return names[0];
    }
}
