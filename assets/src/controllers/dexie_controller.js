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
        // order: Object // e.g. {dateAdded: 'DESC'} (could be an array?)
    };
    static outlets = ["app"]; // can this be passed in?
    dbUtils = null;

    connect() {
        if(this.initDbValue){
            let dbUtils = new DbUtilities(this.globalsValue.config);
            var that = this;
            dbUtils.initDatabase().then(() => {
                that.dbUtils = dbUtils;
                var artists = window.db.table('artists').toArray().then((artists) => {
                    console.log("artitst",artists)
                }).catch((e) => {
                    alert(e);
                    console.error(e);
                });
                
            });
            //this.dbUtils = dbUtils;
            return;
            //dbUtils.initDatabase(this.globalsValue.config);
        }
        
        this.element.setAttribute("data-survos--js-twig-bundle--dexie-target", "content");
        // this.contentTarget.innerHTML = 'from connect ' + this.storeValue;
        // by default, the template id is the caller basename
        console.assert(this.refreshEventValue, "missing refreshEvent");
        console.assert(this.hasAppOutlet, "missing app outlet");
        console.assert(this.dbNameValue, "missing dbName");

        // this.appOutlet.setTitle('test setTitle from appOutlet');
        // this.populateEmptyTables(db, this.configValue['stores']);

        this.filter = this.filterValue ? JSON.parse(this.filterValue) : false;
        this.store = this.storeValue ? JSON.parse(this.storeValue) : false;
        console.info("hi from " + this.identifier + ' using dbName: ' + this.dbNameValue + '/' + this.storeValue);
        // compile the template

        let compiledTwigTemplates = {};

        // these are the templates within the <twig:dexie> component
        for (const [key, value] of Object.entries(this.twigTemplatesValue)) {
            compiledTwigTemplates[key] = Twig.twig({
                data: value.html.trim(),
            });
        }
        this.compiledTwigTemplates = compiledTwigTemplates;

        // the actual jstwig template code, passed into the renderer
        // this should be multiple templates, dispatched as events or populating a target if it exists.
        this.template = Twig.twig({
            data: this.twigTemplateValue,
        });

        let type = 'dexie:load';
        console.error(`listening for ${type}`);
        document.addEventListener(type, (e) => {
            console.error(`listening for ${type}`);
            console.error(`heard ${type}`, this.store.name, this.store.url, this.store.schema);
            if (!window.called) {
                window.called = true;
                this.openDatabase(this.dbNameValue);
            } else {
                this.openDatabase(this.dbNameValue);
            }
            this.dispatch(new CustomEvent('appOutlet.connected', {detail: app.identifier}));
            // the data comes from the topPage data
            console.warn(this.identifier + " heard %s event! %o", e.type, e.detail);
        });
        // hack to fire this
        this.dispatch(new CustomEvent(type));


        // register dexie events that use the database to update a page or tab
        const eventName = this.refreshEventValue;
        var controller = this;
        if (eventName) {
            // console.warn(`Listening for ${eventName}`);
            // console.warn("Current content: " + this.contentTarget.innerHTML);
            document.addEventListener(eventName, (e) => {
                //
                console.log(window.app);
                // the data comes from the topPage data
                console.warn(this.identifier + " heard %s event! %o", e.type, e.detail);
                // console.error('@get the db and pass it to the template');
                // document.getElementById('test').innerHTML = "hello this is " + e.type;

                if (e.detail.hasOwnProperty('id')) {
                    if (window.app && window.app.views && window.app.views.get(".panel-view")) {
                        window.app.views.get(".panel-view").router.navigate("/pages/" + this.storeValue + "_list/", {
                            animate: false,
                        });
                    } else {
                        //console.error("window.app or window.app.views is not defined");
                    }
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
                            console.log("About to insert rendered template into contentTarget");
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
            });
            return;

        }
        // idea: dispatch an event that app_controller listens for and opens the database if it doesn't already exist.
        // there is only one app_controller, so this.db can be share.
        // app should be in the dom, not sure why this.appOutlet not immediately available when dexie connects.
        // we shouldn't need to call this every time, since appOutlet.getDb caches the db.
        // console.error('can we get rid of this call?')
        document.addEventListener('appOutlet.connected', (e) => {
            // the data comes from the topPage data
            console.warn(this.identifier + " heard %s event! %o", e.type, e.detail);

            // console.error(e.detail.id, this.storeValue);
            // @todo: types of events, like detail, list,
            if (e.detail.hasOwnProperty('id')) {
                let html = this.renderPage(e.detail.id, this.storeValue);
                console.warn(html);
            } else {

                this.contentConnected();
            }
        });
    }



    convertArrayToObject(array, key) {
        return array.reduce((acc, curr) => {
            acc[curr.name] = curr.schema;
            return acc;
        }, {});
    }

    // initialize() {
    //     super.initialize();
    //     console.info("initializing %s", this.dbNameValue);
    // }

    // opens the database and sets the global this.db.  Also pushes that db to appOutlet
    async openDatabase(dbName) {
        // Get the hash parameter from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const hashParam = urlParams.get('hash');

        // Get the stored hash from localStorage
        const storedHash = localStorage.getItem('databaseHash');


        // If the hash parameter is provided and it doesn't match the stored hash
        // or if there's no stored hash, delete the database
        if (hashParam && hashParam !== storedHash) {
            // Delete the database
            await Dexie.delete(dbName);
            console.info("Deleted existing database.");

            // Store the new hash in localStorage
            localStorage.setItem('databaseHash', hashParam);
        }
        // this opens the database for every dexie connection!
        console.assert(this.dbNameValue, "Missing dbName in dexie_controller");
        const db = new Dexie(this.dbNameValue);

        let schema = this.convertArrayToObject(this.configValue.stores);
        db.version(this.versionValue).stores(schema);
        await db.open();
        this.db = db;
        window.db = db;
        this.dbUtils = new DbUtilities(db);
        console.info(`connection to ${this.dbNameValue} succeeded`, schema, this.configValue.stores);

        // this.appOutlet.test("I am from dexie")
        // there should only be one app, but sometimes it appears to be zero.
        // this.appOutlet.setDb(this.db);
        await this.contentConnected();

        console.info(
            "at this point, the tables should be populated and db should be open"
        );
        // return this.db;
    }

    appOutletConnected(app, element) {
        // return; // move to regular events
        // console.warn(app, element);

        if (!window.called) {
            window.called = true;

            //disable temproraly
            //this.openDatabase(this.dbNameValue);
        }

        this.dispatch(new CustomEvent('appOutlet.connected', {detail: app.identifier}));


        return;

        this.appOutlet.setDb(window.db); // ??

        console.assert(this.hasAppOutlet, "no appOutlet!");
        this.db = this.appOutlet.getDb();
        if (!this.db) {
            this.db = this.openDatabase();
            this.db = this.appOutlet.setDb(this.db);
        }

        this.filter = this.appOutlet.getFilter(); // the global filter, like projectId

        // console.warn(this.hasAppOutlet, this.appOutlet.getCurrentProjectId());
        if (this.db) {
            this.appOutlet.setDb(this.db);
        } else {
            this.db = this.appOutlet.getDb();
        }
        // console.log(app.identifier + '_controller', body);
        // console.error('page data', this.appOutlet.getProjectId);
    }

    async populateEmptyTables(db, stores, filteredStores) {
        let shouldReload = false;
        for (const store of stores) {
            let t = window.db.table(store.name);
            if (!this.hasAppOutlet) {

                return;
            }
            const isPopulated = await this.dbUtils.isPopulated(store.name);
            if (isPopulated) {
                continue;
            }
            // const count = await new Promise((resolve, reject) => {
            //     t.count(count => resolve(count)).catch(reject);
            // });
            // if (count > 0) {
            //     // console.warn("%s already has %d", t.name, count);
            //     continue; // Move to the next store
            // }
            shouldReload = true;
            console.warn(store.name, store.url);
            console.warn("%s has no data, loading...", t.name, filteredStores.find((f) => f.name === store.name));
            // const filteredUrl = filteredStores ? filteredStores.find((f)=> f.name === store.name).url : store.url;
            const filteredUrl = store.url;
            // Fetch and bulk put data for each page
            //await loadData(filteredUrl, store.name);
            await DbUtilities.syncTable(db, store.name,store.url);
            // console.warn("Done populating.");
            try {
            } catch (error) {
                console.error("Error populating table", t.name, error);
            }
        }
        // what listens to this??
        document.dispatchEvent(new CustomEvent('window.db.available', {'detail': {dbName: db.name}}));
        if (shouldReload) {
            window.location.reload(); // Reload after populating all tables
        }
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

        alerty('rendering table');

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


    async renderPage(key, store) {
        // console.log(this.appOutlet.tabbarTarget.getActiveIndex());
        //
        // console.warn(this.appOutlet.tabbarTarget.getActiveIndex());

        // console.error("top page %o", this.appOutlet.navigatorTarget.topPage);
        // console.error("page data", this.appOutlet.navigatorTarget.topPage.data);
        // let key = this.appOutlet.navigatorTarget.topPage.data.id;
        // console.error(this.appOutlet.navigatorTarget.topPage.data, key);
        store = JSON.parse(store);
        let table = window.db["table"](store.name);
        table = table.get(parseInt(key));
        table
            .then((data) => {

                    return {
                        content: this.template.render({
                            data: data,
                            globals: this.globalsValue,
                        }),
                        // if there's a <twig:block name="title"> use it to render the title
                        title:
                            this.compiledTwigTemplates.hasOwnProperty('title')
                                ? this.compiledTwigTemplates["title"].render({
                                    data: data,
                                    window: window,
                                    globals: this.globalsValue,
                                })
                                : 'no title'
                    };
                }
            )
            .then(
                ({
                     content,
                     title
                 }
                ) => {
                    this.contentTarget.innerHTML = content;
                    console.log(title);
                    if (this.hasAppOutlet) {

                        //commented for now (avoid error)
                        ///this.appOutlet.setTitle(title);
                    }
                }
            )
            .catch((e) => console.error(e))
            .finally((e) => console.log("finally rendered page"));

    }

}

/*
load all the rows in a json-ld (e.g. api-platform) endpoint

The dexie database must be connected and initialized this is called.
 */

async function loadData(url, tableName) {
    let nextPageUrl = url;
    while (nextPageUrl) {
        console.log("fetching " + nextPageUrl);
        const response = await fetch(nextPageUrl);
        const data = await response.json();
        console.log(data);

        // Bulk put data for this page
        const t = window.db.table(tableName);
        const rows = data["member"];
        console.log(rows);
        await t.bulkPut(rows)
            .then((x) => console.log("bulk add", x))
        // .catch((e) => console.error(e))
        ;

        console.table(rows[1] ?? []);

        // Check if there's a next page
        nextPageUrl = data["view"] && data["view"]["next"] ? data["view"]["next"] : null;
    }
}
