import { Controller } from '@hotwired/stimulus';
import { installTwigAPI, getRegistryEngine, installFosRoutingFromData } from '../lib/twig_api.js';
import { routingData } from '@survos/js-twig/generated/fos_routes.js';
import { compileTwigBlocks, twigRender } from '../lib/twig_blocks.js';

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
        installTwigAPI({ blockRegistry: this._tpl });
        installFosRoutingFromData(getRegistryEngine(this._tpl), routingData);

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
