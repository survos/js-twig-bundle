import { Controller } from "@hotwired/stimulus";
import { createEngine } from '@tacman1123/twig-browser';
import { installSymfonyTwigAPI } from '@tacman1123/twig-browser/adapters/symfony';
import { DbUtilities } from "../lib/dexieDatabase.js";
import Dexie from "dexie";

/* make sure this is loaded eagerly in assets/controllers.json so that listeners
   are registered before any events fire:
   "@survos/js-twig-bundle": {
       "dexie": { "enabled": true, "fetch": "eager" }
   }
*/

/* stimulusFetch: 'eager' */
export default class extends Controller {
    static targets = ['content'];
    static values = {
        twigTemplate:       String,
        twigTemplates:      Object,
        refreshEvent:       String,
        type:               { type: String, default: 'list' },
        dbName:             String,
        caller:             String,
        config:             Object,
        version:            Number,
        store:              { type: String, default: '{}' },
        globals:            Object,
        key:                String,
        filter:             { type: String, default: '{}' },
        initDb:             Boolean,
        queries:            Object,
    };
    static outlets = ['app'];

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    async connect() {
        // Self-target so the template has somewhere to render into
        this.element.setAttribute('data-survos--js-twig-bundle--dexie-target', 'content');

        console.assert(this.refreshEventValue, '[dexie] missing refreshEvent value');
        console.assert(this.hasAppOutlet,       '[dexie] missing app outlet');
        console.assert(this.dbNameValue,        '[dexie] missing dbName value');

        this._filter = this.filterValue ? JSON.parse(this.filterValue) : {};
        this._store  = this.storeValue  ? JSON.parse(this.storeValue)  : {};

        // Build twig-browser engine
        this._engine = createEngine();
        installSymfonyTwigAPI(this._engine);
        try {
          const { path } = await import('@survos/js-twig/generated/fos_routes.js');
          this._engine.registerFunction('path', path);
        } catch { /* FOS routing not available */ }

        // Pre-compile all named templates
        this._compiled = {};
        for (const [name, payload] of Object.entries(this.twigTemplatesValue)) {
            const src = typeof payload === 'string' ? payload : (payload?.html ?? '');
            try {
                this._engine.compileBlock(name, src);
                this._compiled[name] = true;
            } catch (e) {
                console.error(`[dexie] compile error in block "${name}":`, e.message);
            }
        }

        // Also compile the primary twigTemplate value if provided
        if (this.twigTemplateValue) {
            try {
                this._engine.compileBlock('__primary__', this.twigTemplateValue);
                this._compiled['__primary__'] = true;
            } catch (e) {
                console.error('[dexie] compile error in primary twigTemplate:', e.message);
            }
        }

        // Listen for the refresh event
        if (this.refreshEventValue) {
            document.addEventListener(this.refreshEventValue, (e) => this._onRefresh(e));
        }
    }

    // ------------------------------------------------------------------
    // Event handler
    // ------------------------------------------------------------------

    async _onRefresh(e) {
        console.log(`[dexie] ${this.refreshEventValue} fired`, e.detail);

        if (Object.prototype.hasOwnProperty.call(e.detail ?? {}, 'id')) {
            await this.renderPage(e.detail.id, this.storeValue);
        } else {
            await this._renderList();
        }
    }

    // ------------------------------------------------------------------
    // List render (no id — show all rows matching filter)
    // ------------------------------------------------------------------

    async _renderList() {
        if (!window.db) {
            console.error('[dexie] window.db not available');
            return;
        }

        const store = this._store;
        let table = window.db.table(store.name);

        if (this._filter && Object.keys(this._filter).length) {
            table = table.filter((row) =>
                Object.entries(this._filter).every(([k, v]) => row[k] === v)
            );
        }

        const rows = await table.toArray();
        const html = this._render('__primary__', { rows, globals: this.globalsValue });
        if (this.hasContentTarget) {
            this.contentTarget.innerHTML = html;
        }
    }

    // ------------------------------------------------------------------
    // Detail render (entity by id, multiple named queries)
    // ------------------------------------------------------------------

    async renderPage(entityId, store) {
        if (!window.db) {
            console.error('[dexie] window.db not available');
            return;
        }

        const entities = {};
        let title = 'Untitled';

        for (const [key, query] of Object.entries(this.queriesValue)) {
            if (!query.templateName) {
                console.error(`[dexie] missing templateName for query "${key}"`);
                continue;
            }
            if (!this._compiled[query.templateName]) {
                console.error(`[dexie] block "${query.templateName}" was not compiled`);
                continue;
            }

            const entityTable = window.db[query.store];
            console.assert(entityTable, `[dexie] missing table "${query.store}"`);

            let entity;
            if (query.filters) {
                // Render any twig expressions inside the filter values against accumulated entities
                const renderedFilters = this._renderFiltersObject(query.filters, entities);
                entity = await entityTable[query.filterType](renderedFilters).toArray();
            } else {
                entity = await entityTable.get(entityId)
                    ?? await entityTable.get(parseInt(entityId, 10));
            }

            entities[key] = entity;

            if (this._compiled['title']) {
                title = this._render('title', { data: entity });
            }

            const html = this._render(query.templateName, {
                data: entity,
                globals: this.globalsValue,
            });

            this.contentTarget.innerHTML += html;
        }

        this.appOutlet.setTitle(title);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /** Render a compiled block, returning an error string on failure. */
    _render(blockName, context = {}) {
        try {
            return this._engine.renderBlock(blockName, context);
        } catch (e) {
            console.error(`[dexie] render error in block "${blockName}":`, e.message);
            return `<div class="alert alert-danger">[dexie render error] ${blockName}: ${e.message}</div>`;
        }
    }

    /**
     * Walk a filter-spec object and render any string values as twig snippets
     * against the accumulated entity context (mirrors old renderTwigInObject).
     */
    _renderFiltersObject(obj, context) {
        if (typeof obj === 'string') {
            try {
                this._engine.compileBlock('__filter_expr__', obj);
                return this._engine.renderBlock('__filter_expr__', context);
            } catch {
                return obj;
            }
        }
        if (Array.isArray(obj)) return obj.map(item => this._renderFiltersObject(item, context));
        if (obj && typeof obj === 'object') {
            return Object.fromEntries(
                Object.entries(obj).map(([k, v]) => [k, this._renderFiltersObject(v, context)])
            );
        }
        return obj;
    }

    appOutletConnected(app) {
        this.dispatch(new CustomEvent('appOutlet.connected', { detail: app.identifier }));
    }

    async contentConnected() {
        await this._renderList();
    }
}
