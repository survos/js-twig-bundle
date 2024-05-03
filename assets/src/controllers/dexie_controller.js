import { Controller } from "@hotwired/stimulus";

// https://javascript.plainenglish.io/12-best-practices-for-writing-asynchronous-javascript-like-a-pro-5ac4cb95d3c8
// now called from the TwigJsComponent Component, so it can pass in a Twig Template
// combination api-platform, inspection-bundle, dexie and twigjs
// loads data from API Platform to dexie, renders dexie data in twigjs

// import db from '../db.js';
import Twig from "twig";
import Dexie from "dexie";
import {
    stimulus_controller,
    stimulus_action,
    stimulus_target,
} from "stimulus-attributes";

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
});

/* stimulusFetch: 'lazy' */
export default class extends Controller {
    static targets = ["content"];
    static values = {
        twigTemplate: String,
        twigTemplates: Object,
        refreshEvent: String,
        dbName: String,
        caller: String,
        // because passing an object is problematic if empty, just pass the config and parse it.
        // https://github.com/symfony/stimulus-bridge/issues/89
        config: Object,
        // schema: Object,
        // tableUrls: Object,
        version: Number,
        store: String,
        globals: Object,
        key: String, // overrides filter, get a single row.  ID is a reserved word!!
        filter: {
            type: String,
            default: "{}",
        }, // {status: 'queued'}
        // order: Object // e.g. {dateAdded: 'DESC'} (could be array?)
    };
    static outlets = ["app"]; // could pass this in, too.

    connect() {
        console.assert(this.dbNameValue, "missing dbName");
        // this.appOutlet.setTitle('test setTitle from appOutlet');
        // this.populateEmptyTables(db, this.configValue['stores']);

        // console.warn("hi from " + this.identifier + ' using dbName: ' + this.dbNameValue + '/' + this.storeValue);
        this.filter = this.filterValue ? JSON.parse(this.filterValue) : false;
        // console.error(this.callerValue, this.filterValue, this.filter);
        // compile the template

        let compiledTwigTemplates = {};
        for (const [key, value] of Object.entries(this.twigTemplatesValue)) {
            compiledTwigTemplates[key] = Twig.twig({
                data: value,
            });
        }
        this.compiledTwigTemplates = compiledTwigTemplates;
        this.template = Twig.twig({
            data: this.twigTemplateValue,
        });

        if (this.refreshEventValue) {
            document.addEventListener(this.refreshEventValue, (e) => {
                console.log("i heard an event! " + e.type);
                this.contentConnected();
            });
        }
        // idea: dispatch an event that app_controller listens for and opens the database if it doesn't already exist.
        // there is only one app_controller, so this.db can be share.
        // app should be in the dom, not sure why this.appOutlet not immediately available when dexie connects.
        console.assert(this.hasAppOutlet, "appOutlet not loaded!");
        // we shoulddn't need to call this every time, since appOutlet.getDb caches the db.
        // console.error('can we get rid of this call?')

        if (!window.called) {
            window.called = true;
            this.openDatabase(this.dbNameValue);
        }

        // maybe is has one but isn't connected?
        if (this.hasAppOutlet) {
            // moved to appOutletConnected
            // get the database from the app.  Create it if it doesn't exist.
            // this.db = this.appOutlet.getDb();
            // if (!this.db) {
            //     this.openDatabase(this.dbNameValue);
            //     // this.appOutlets.forEach(app => app.setDb(db));
            //     // this.contentConnected();
            // }
        }
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
        console.info("dispatched successfully");

        // populate the tables after the db is open
        await this.populateEmptyTables(this.db, this.configValue.stores);

        // there should only be one app, but sometimes it appears to be zero.
        // this.appOutlet.setDb(this.db);
        this.contentConnected();

        console.info(
            "at this point, the tables should be populated and db should be open"
        );
        return this.db;
    }

    appOutletConnectedxx(app, body) {
        console.log(
            `${this.callerValue}: ${app.identifier}_controller is now connected to ` +
            this.identifier +
            "_controller"
        );

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

    async populateEmptyTables(db, stores) {
        let shouldReload = false;
        for (const store of stores) {
            console.warn(store);
            let t = window.db.table(store.name);
            try {
                const count = await new Promise((resolve, reject) => {
                    t.count(count => resolve(count)).catch(reject);
                });

                if (count > 0) {
                    // console.warn("%s already has %d", t.name, count);
                    continue; // Move to the next store
                }
                shouldReload = true;
                console.warn("%s has no data, loading...", t.name);
                // Fetch and bulk put data for each page
                await loadData(store.url,store.name);
                // console.warn("Done populating.");
            } catch (error) {
                console.error("Error populating table", t.name, error);
            }
        }
        document.dispatchEvent(new CustomEvent('window.db.availble', {'detail': {dbName: db.name}}));
        if (shouldReload) {
            window.location.reload(); // Reload after populating all tables
        }
    }

    // because this can be loaded by Turbo or Onsen
    async contentConnected() {
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
        // is db a Dexie instance?  It shouldn't be complaining about void;
        // https://dexie.org/docs/Dexie/Dexie.table()
        let table = window.db.table(this.storeValue);
        console.log(table);

        if (this.hasAppOutlet) {
            // console.error(this.hasAppOutlet, this.appOutlet.getCurrentProjectId());
        }

        // if (this.filter) {
        //     this.filter = {'owned': true};
        //     table = table.where({owned: true}).toArray().then(rows => console.log(rows)).catch(e => console.error(e));
        // }
        // // console.log(table);
        // return;
        if (this.hasAppOutlet) {
            // this.appOutlet.setTitle('hello???');
            // console.error(this.appOutlet.getFilter());
            // this.filter = this.appOutlet.getFilter();
        } else {
            // let appOutlet = document.getElementById('app_body').getAttribute('id');
            // appOutlet.setTitle('hello???');
            console.assert(this.hasAppOutlet, "missing appOutlet");
            return;
        }

        if (this.filter) {
            if (this.appOutlet.getFilter()) {
                this.filter = {
                    ...this.filter,
                    ...this.appOutlet.getFilter(this.refreshEventValue),
                };
                // console.error(this.filter);
            }
        } else {
            this.filter = this.appOutlet.getFilter(this.refreshEventValue);
        }

        // this.appOutlet.setTitle('hello???!');
        if (this.keyValue) {
            console.error("page data", this.appOutlet.navigatorTarget.topPage.data);
            let key = this.appOutlet.navigatorTarget.topPage.data.id;
            console.error(this.appOutlet.navigatorTarget.topPage.data, key);
            table = table.get(parseInt(key));
            table
                .then((data) => {
                    return {
                        content: this.template.render({
                            data: data,
                            globals: this.globalsValue,
                        }),
                        title: this.compiledTwigTemplates["title"].render({
                            data: data,
                            globals: this.globalsValue,
                        }),
                    };
                })
                .then(({ content, title }) => {
                    this.contentTarget.innerHTML = content;
                    console.log(title);
                    if (this.hasAppOutlet) {
                        console.error(title);
                        this.appOutlet.setTitle(title);
                    }
                })
                .catch((e) => console.error(e))
                .finally((e) => console.log("finally rendered page"));

            return;
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

        // table.toArray().then( (data) => {
        //     data.forEach( (row) => {
        //         console.log(row);
        //         // nextPokenumber++;
        //     })
        // })

        table
            .toArray()
            .then((rows) =>
                this.template.render({ rows: rows, globals: this.globalsValue })
            )
            .then((html) => (this.element.innerHTML = html));
    }
}

async function loadData(url, tableName) {
    let nextPageUrl = url;

    while (nextPageUrl) {
        console.log("fetching " + nextPageUrl);
        const response = await fetch(nextPageUrl);
        const data = await response.json();
        console.log(data);

        // Bulk put data for this page
        const t = window.db.table(tableName);
        await t.bulkPut(data["hydra:member"])
            .then((x) => console.log("bulk add", x))
            .catch((e) => console.error(e));

        console.warn("Done populating.", data["hydra:member"][1]);

        // Check if there's a next page
        nextPageUrl = data["hydra:view"] && data["hydra:view"]["hydra:next"] ? data["hydra:view"]["hydra:next"] : null;
    }
}
