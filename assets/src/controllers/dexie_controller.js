import {Controller} from "@hotwired/stimulus";

/* make sure this loaded eagerly in assets/controllers.json, so that the listeners are available!
"@survos/js-twig-bundle": {
    "dexie": {
        "enabled": true,
            "fetch": "eager",
            "autoimport": []
    },
 */

// https://medium.com/@chandantechie/10-best-practices-for-writing-asynchronous-javascript-like-a-pro-2cb3a14587ba
// now called from the TwigJsComponent Component, so it can pass in a Twig Template
// combination api-platform, inspection-bundle, dexie and twigjs
// loads data from API Platform to dexie, renders dexie data in twigjs
// import db from '../db.js';
import Twig from "twig";
import Dexie from "dexie";
import {stimulus_action, stimulus_controller, stimulus_target,} from "stimulus-attributes";

// @todo: fail gracefully if these files don't exist.
import Routing from 'fos-routing';
import RoutingData from '/js/fos_js_routes.js';

import { DbUtilities } from "../lib/dexieDatabase.js";

Routing.setData(RoutingData);

Twig.extend(function (Twig) {
    Twig._function.extend(
        "stimulus_controller",
        (
            controllerName,
            controllerValues = {},
            controllerClasses = {},
            controllerOutlets = ({} = {})
        ) =>
            stimulus_controller(
                controllerName,
                controllerValues,
                controllerClasses,
                controllerOutlets
            )
    );
    Twig._function.extend("stimulus_target", (controllerName, r = null) =>
        stimulus_target(controllerName, r)
    );
    Twig._function.extend(
        "stimulus_action",
        (controllerName, r, n = null, a = {}) =>
            stimulus_action(controllerName, r, n, a)
    );
    Twig._function.extend('path', (route, routeParams = {}) => {
        delete routeParams._keys; // seems to be added by twigjs
        return Routing.generate(route, routeParams);
    });
});

/* stimulusFetch: 'eager' */
export default class extends Controller {
    static targets = ['content'];
    static values = {
        twigTemplate: String, // the specific template to render
        twigTemplates: Object,
        refreshEvent: String,
        type: {
            type: String,
            default: "list", // list, item
        },
        dbName: String,
        caller: String,
        // because passing an object is problematic if empty, just pass the config and parse it.
        // https://github.com/symfony/stimulus-bridge/issues/89
        config: Object,
        // schema: Object,
        // tableUrls: Object,
        version: Number,
        store: {
            type: String,
            default: "{}",
        }, // {status: 'queued'}
        globals: Object,
        key: String, // overrides filter, get a single row.  ID is a reserved word!!
        filter: {
            type: String,
            default: "{}",
        }, // {status: 'queued'}
        initDb: Boolean,
        queries : Object
        // order: Object // e.g. {dateAdded: 'DESC'} (could be an array?)
    };
    static outlets = ["app"]; // can this be passed in?
    dbUtils = null;

    connect() {
        // hack until we can figure out how to do this elegantly.
        this.element.setAttribute("data-survos--js-twig-bundle--dexie-target", "content");
        // this.contentTarget.innerHTML = 'from connect ' + this.storeValue;
        // by default, the template id is the caller basename
        console.assert(this.refreshEventValue, "missing refreshEvent");
        console.assert(this.hasAppOutlet, "missing app outlet");
        console.assert(this.dbNameValue, "missing dbName");

        // this.populateEmptyTables(db, this.configValue['stores']);

        this.filter = this.filterValue ? JSON.parse(this.filterValue) : false;
        this.store = this.storeValue ? JSON.parse(this.storeValue) : false;
        // console.info("hi from " + this.identifier + ' using dbName: ' + this.dbNameValue + '/' + this.storeValue);
        // compile the template

        let compiledTwigTemplates = {};

        // these are the templates within the <twig:dexie> component
        for (const [key, value] of Object.entries(this.twigTemplatesValue)) {
            compiledTwigTemplates[key] = Twig.twig({
                data: value.html.trim(),
            });
        }
        this.compiledTwigTemplates = compiledTwigTemplates;
        // console.log("twig templates : ",this.compiledTwigTemplates);

        // the actual jstwig template code, passed into the renderer
        // this should be multiple templates, dispatched as events or populating a target if it exists.
        this.template = Twig.twig({
            data: this.twigTemplateValue,
        });

        // register dexie events that use the database to update a page or tab
        const eventName = this.refreshEventValue;
        var controller = this;
        if (eventName) {
            // console.warn(`Listening for ${eventName}`);
            // console.warn("Current content: " + this.contentTarget.innerHTML);
            document.addEventListener(eventName, (e) => {
                console.warn("event %s fired", eventName);
                console.log(e.detail);
                //
                console.log(window.app);
                // the data comes from the topPage data
                console.warn(this.identifier + " heard %s event! %o", e.type, e.detail);
                // console.error('@get the db and pass it to the template');
                // document.getElementById('test').innerHTML = "hello this is " + e.type;

                if (e.detail.hasOwnProperty('id')) {
                    if (window.app && window.app.views && window.app.views.get(".panel-view")) {
                        window.app.views.get(".panel-view").router.navigate("/pages/" + JSON.parse(this.storeValue).name + "_list/", {
                            animate: false,
                        });
                    } else {
                        //console.error("window.app or window.app.views is not defined");
                    }
                    console.log(this.queriesValue);

                    this.renderPage(e.detail.id, this.storeValue);
                    //console.warn(html);

                } else {
                    let store = JSON.parse(this.storeValue);
                    let table = window.db.table(store.name);
                    table
                        .toArray()
                        .then((rows) => {
                            // render the template with a collection of items
                            let x =  this.template.render({
                                rows: rows,
                                window: window,
                                storeName: this.storeValue,
                                globals: this.globalsValue});
                            // console.log("About to insert rendered template into contentTarget");
                            // console.log("contentTarget", this.contentTarget);
                            if (this.contentTarget) {
                                this.contentTarget.innerHTML = x;
                            }
                        })
                        // .then((html) => {
                        //     console.warn(html);
                        //         this.contentTarget.innerHTML = html;
                        //     }
                        // )
                        .catch((e) => console.error(e))
                        .finally((e) => console.log("populated the template with the data"));
                }


                return;

                table.count().then((count) => {
                    let html = "There are " + count + " " + store + " in the database";
                    this.contentTarget.innerHTML = html;
                    let data = table.rows;
                    console.error(store, html, data);
                    if (this.compiledTwigTemplates.hasOwnProperty('twig_template')) {
                        html = this.compiledTwigTemplates["twig_template"].render({
                            data: data,
                            globals: this.globalsValue,
                        });
                        console.error(html);
                    }
                    this.contentTarget.innerHTML = html;
                    console.error(html, this.contentTarget);
                    // inject the result

                });
                return;
                table
                    .toArray()
                    .then((rows) =>
                        // render the template with a collection of items
                        this.template.render({rows: rows, globals: this.globalsValue})
                    )
                    .then((html) => {
                            this.element.innerHTML = html;
                        }
                    )
                    .catch((e) => console.error(e))
                    .finally((e) => console.log("populated the template with the data"));

                console.error(this.storeValue, this.filter, e.detail);
                // set rows = await query the dexie for the rows.
                // console.error(e.detail.id, this.storeValue);
                // @todo: types of events, like detail, list
                if (e.detail.hasOwnProperty('id')) {
                    let html = this.renderPage(e.detail.id, this.storeValue);
                    console.warn(html);

                } else {
                    this.contentConnected();
                }
            },{
                once: true,
            });
            return;

        }
        // idea: dispatch an event that app_controller listens for and opens the database if it doesn't already exist.
        // there is only one app_controller, so this.db can be share.
        // app should be in the dom, not sure why this.appOutlet not immediately available when dexie connects.
        // we shouldn't need to call this every time, since appOutlet.getDb caches the db.
        // console.error('can we get rid of this call?')

        // document.addEventListener('appOutlet.connected', (e) => {
        //     // the data comes from the topPage data
        //     // console.warn(this.identifier + " heard %s event! %o", e.type, e.detail);
        //     // this.appOutlet.setTitle('test setTitle from appOutlet');

        //     // console.error(e.detail.id, this.storeValue);
        //     // @todo: types of events, like detail, list,
        //     if (e.detail.hasOwnProperty('id')) {
        //         let html = this.renderPage(e.detail.id, this.storeValue);
        //         console.warn(html);
        //     } else {

        //         this.contentConnected();
        //     }
        // });
    }



    convertArrayToObject(array, key) {
        return array.reduce((acc, curr) => {
            acc[curr.name] = curr.schema;
            return acc;
        }, {});
    }

    appOutletConnected(app, element) {
        // return; // move to regular events
        if (!window.called) {
            window.called = true;
            //disable temproraly
            //this.openDatabase(this.dbNameValue);
        }

        this.dispatch(new CustomEvent('appOutlet.connected', {detail: app.identifier}));

    }

    // because this can be loaded by Turbo or Onsen
    async contentConnected() {

        console.warn("Content is connected! Populate tables if empty")
        // console.error(this.outlets);
        // this.outlets.forEach( (outlet) => console.warn(outlet));
        // if this is fired before the database is open, return, it'll be called later
        // if (!this.db) {
        //     console.error('db is not connected, it should be loaded in appOutletConnected.');
        //     return;
        // }
        if (!window.db) {
            console.error(
                "db is not connected, it should be loaded in appOutletConnected."
            );
            return;
        }
        // console.error(window.db);
        // is db a Dexie instance?  It shouldn't be complaining about void, it thinks it's a console table
        // https://dexie.org/docs/Dexie/Dexie.table()
        let table = window.db.table(this.storeValue);
        // let table = window.db.table(this.storeValue);
        // console.error(table,  this.storeValues)

        // if (this.filter) {
        //     this.filter = {'owned': true};
        //     table = table.where({owned: true}).toArray().then(rows => console.log(rows)).catch(e => console.error(e));
        // }
        // // console.log(table);
        // return;

        if (this.filter.length) {
            console.log(this.filter);
            if (this.hasAppOutlet)
                try {
                    if (this.appOutlet.getFilter()) {
                        this.filter = {
                            ...this.filter,
                            ...this.appOutlet.getFilter(this.refreshEventValue),
                        };
                        // console.error(this.filter);
                    }
                } catch (e) {
                    console.error(e.message);
                }
        } else {
            this.filter = this.appOutlet.getFilter(this.refreshEventValue);
        }

        // populate the tables after the db is open

        // const modifiedStores = this.appOutlet.getProjectFiltered(this.configValue.stores);
        const modifiedStores = [];

        await this.populateEmptyTables(window.db, this.configValue.stores, modifiedStores);

        // this.appOutlet.setTitle('hello???!');
        if (this.keyValue) {
            console.error(this.keyValue, "@render ".this.keyValue);
            // this.renderPage(this.storeValue, this.keyValue);
        } else if (this.filter) {
            table = table.filter((row) => {
                // there's probably a way to use reduce() or something
                let okay = true;
                for (const [key, value] of Object.entries(this.filter)) {
                    // @todo: check for array and use 'in array'
                    okay = okay && row[key] === value;
                    // console.log(`${key}: ${value}`, row[key] === value, okay);
                }
                return okay;
            });
        }

        table.count().then((c) => {
            console.assert(c, "missing rows in table");
        });

        table
            .toArray()
            .then((rows) =>
                // render the template with a collection of items
                 this.template.render({rows: rows, globals: this.globalsValue})
            )
            .then((html) => {
                    this.element.innerHTML = html;
                }
            )
            .catch((e) => console.error(e))
            .finally((e) => console.log("populated the template with the data"));
    }

    // Function to render all string values in an object recursively


    async renderPage(entityId, store) {

        function renderTwigInObject(obj, context) {
            if (typeof obj === 'string') {
                return Twig.twig({ data: obj }).render(context);
            }

            if (Array.isArray(obj)) {
                return obj.map(item => renderTwigInObject(item, context));
            }

            if (typeof obj === 'object' && obj !== null) {
                return Object.fromEntries(
                    Object.entries(obj).map(([key, val]) => [key, renderTwigInObject(val, context)])
                );
            }

            return obj;
        }
        // console.log(this.appOutlet.tabbarTarget.getActiveIndex());
        //
        // console.warn(this.appOutlet.tabbarTarget.getActiveIndex());

        // console.error("top page %o", this.appOutlet.navigatorTarget.topPage);
        // console.error("page data", this.appOutlet.navigatorTarget.topPage.data);
        // let key = this.appOutlet.navigatorTarget.topPage.data.id;
        // console.error(this.appOutlet.navigatorTarget.topPage.data, key);

        //artist temp area
        //alert(this.compiledTwigTemplates["title"]);
        //alert(JSON.stringify(this.queriesValue));
        //loop through the queries

        //set an object to store all the grabbed entities
        let entities = {};
        let title = "Untitled";

        for (const [key, value] of Object.entries(this.queriesValue)) {
            //console.log('store : ', value.store);
            //make sure value.templateName exists
            if (!value.templateName) {
                console.error("missing templateName for %s", key);
                continue;
            }
            if (this.compiledTwigTemplates.hasOwnProperty(value.templateName)) {
                let entityTable = window.db[value.store];
                let entity = null;
                console.error("entity", entity);
                //check if value has filters
                if (value.hasOwnProperty('filters')) {
                    const renderedFilters = renderTwigInObject(value.filters, entities);
                    entity = await entityTable[value.filterType](renderedFilters).toArray();
                } else {
                    //just get by id for now
                    entity = await entityTable.get(entityId);
                    if (!entity) {
                        const entityIdAsInt = parseInt(entityId, 10);
                        if (!isNaN(entityIdAsInt)) {
                            entity = await entityTable.get(entityIdAsInt);
                        }
                    }

                    title = this.compiledTwigTemplates.hasOwnProperty('title')
                    ? this.compiledTwigTemplates["title"].render({
                        data: entity
                    })
                    : 'Untitled';

                }

                entities[key] = entity;

                console.log('entities update : ',entities);

                const renderedEntity = this.compiledTwigTemplates[value.templateName].render({
                    data: entity,
                    window: window,
                    globals: this.globalsValue,
                });

                this.contentTarget.innerHTML += renderedEntity;

                //prevent old rendering
                continue;

                entity
                    .then((data) => {
                        entities[key] = data;
                        console.log('entities update : ',entities);
                        const renderedEntity = this.compiledTwigTemplates[value.templateName].render({
                            data: data,
                            window: window,
                            globals: this.globalsValue,
                        });
                        return renderedEntity;
                    })
                    .then((html) => {
                        //console.warn(html);
                        this.contentTarget.innerHTML += html;
                    })
                    .catch((e) => console.error(e))
                    .finally((e) => console.log("finally rendered page"));
            }
        }
        //alert(JSON.stringify(title));
        this.appOutlet.setTitle(title);
        //return to prevent old render
        return;
        //
        store = JSON.parse(store);
        let table = window.db["table"](store.name);


        table = table.get(key);
        table
            .then((data) => {

                // @todo: render from dexie title template
                //     let title = data.title || data.label || data.name || data.id;

                    //set title
                    // let titleElement = document.querySelector(".page-current .navbar .title");
                    // if (titleElement) {
                    //     titleElement.innerHTML = title[this.globalsValue.locale];
                    // }

                    // this is a promise
                console.error(data);
                    const title = this.compiledTwigTemplates.hasOwnProperty('title')
                        ? this.compiledTwigTemplates["title"].render({
                            data: data,
                            window: window,
                            globals: this.globalsValue,
                        })
                        : 'no title';
                    return {
                        content: this.template.render({
                            data: data,
                            globals: this.globalsValue,
                        }),
                        // if there's a <twig:block name="title"> use it to render the title
                        title: title

                    };
                }
            )
            .then(
                ({
                     content,
                     title
                 }
                ) => {
                    title = title.trim();
                    console.error(title);
                    // content target is in dexie component, we need to communicate to the app
                    this.contentTarget.innerHTML = content;
                    console.assert(title, "missing title content");
                    console.assert(this.hasAppOutlet, "Missing appOutlet");
                        //commented for now (avoid error)
                        this.appOutlet.setTitle(title);
                    if (this.hasAppOutlet) {
                    } else {
                        console.error(title, "missing appOutlet");
                    }
                }
            )
            .catch((e) => console.error(e))
            .finally((e) => console.log("finally rendered page"));
    }
}
