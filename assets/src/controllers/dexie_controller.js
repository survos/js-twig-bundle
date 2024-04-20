import {Controller} from '@hotwired/stimulus';

// https://javascript.plainenglish.io/12-best-practices-for-writing-asynchronous-javascript-like-a-pro-5ac4cb95d3c8
// now called from the TwigJsComponent Component, so it can pass in a Twig Template
// combination api-platform, inspection-bundle, dexie and twigjs
// loads data from API Platform to dexie, renders dexie data in twigjs

// import db from '../db.js';
import Twig from 'twig';
import Dexie from 'dexie';

/* stimulusFetch: 'lazy' */
export default class extends Controller {
    static targets = ['content'];
    static values = {
        twigTemplate: String,
        refreshEvent: String,
        dbName: String,
        // because passing an object is problematic if empty, just pass the config and parse it.
        // https://github.com/symfony/stimulus-bridge/issues/89
        config: Object,
        // schema: Object,
        // tableUrls: Object,
        version: Number,
        store: String,
        globals: Object,
        filter: {
            type: String,
            default: '{}'
        }, // {status: 'queued'}
        // order: Object // e.g. {dateAdded: 'DESC'} (could be array?)
    }
    static outlets = ['app']; // could pass this in, too.

    connect() {
        // this.appOutlet.setTitle('test setTitle from appOutlet');
        const db = new Dexie(this.dbNameValue);
        // db.delete();
        // create the schema from the stores
        // https://dev.to/afewminutesofcode/how-to-convert-an-array-into-an-object-in-javascript-25a4
        const convertArrayToObject = (array, key) =>
            array.reduce((acc, curr) => {
                acc[curr.name] = curr.schema;
                return acc;
            }, {});

        let schema = convertArrayToObject(this.configValue.stores);
        // let schema2 = this.configValue.stores.reduce((acc, curr) => {
        //     acc[curr.name] = curr.schema;
        //     return acc;
        // });
        // console.error(schema);
        // return;
        db.version(this.versionValue).stores(schema);
        db.open();
        // this.populateEmptyTables(db, this.configValue['stores']);

        // console.warn("hi from " + this.identifier + ' using dbName: ' + this.dbNameValue + '/' + this.storeValue);
        // console.error(this.filterValue);
        // compile the template
        this.template = Twig.twig({
            data: this.twigTemplateValue
        });
        this.filter = this.filterValue ? JSON.parse(this.filterValue) : false;
        this.db = db;

        this.populateEmptyTables(db, this.configValue.stores);

        this.contentConnected();
        if (this.refreshEventValue) {
            document.addEventListener(this.refreshEventValue, (e => {
                // console.log('i heard an event! ' + e.type);
                this.contentConnected();
            }));
        }
    }

    async populateEmptyTables(db, stores)
    {
        stores.forEach( (store) => {
            let t = db.table(store.name);
            t.count(async c => {
                console.log(t.name, c);
                if (c > 0) {
                    console.warn(`already have ${c} in ` + t.name);
                    return;
                }
                const data = await loadData(store.url);
                console.error(data);
                // let withId = await data.map( (x, id) => {
                //     x.id = id+1;
                //     x.owned = id < 3;
                //     return x;
                // });
                // console.error(data, withId);

                await t.bulkPut(data)
                    .then((x) => console.log('bulk add', x))
                    .catch(e => console.error(e));
                // console.log ("Done populating.", data[1]);

            })
        })
    }

    // because this can be loaded by Turbo or Onsen
    async contentConnected() {
        // console.error(this.outlets);
        // this.outlets.forEach( (outlet) => console.warn(outlet));
        let table = this.db.table(this.storeValue);
        // if (this.filter) {
        //     this.filter = {'owned': true};
        //     table = table.where({owned: true}).toArray().then(rows => console.log(rows)).catch(e => console.error(e));
        // }
        // // console.log(table);
        // return;
        console.log(this);
        if (this.hasAppOutlet) {
            console.error('yes, we have an appOutlet!');
            this.appOutlet.setTitle('hello???');
        } else {
            // let appOutlet = document.getElementById('app_body').getAttribute('id');
            // appOutlet.setTitle('hello???');
            console.assert(this.hasAppOutlet, "missing appOutlet");
        }
        // this.appOutlet.setTitle('hello???');


        if (this.filter) {
            table = table.filter(row => {

                // there's probably a way to use reduce() or something
                let okay = true;
                for (const [key, value] of Object.entries(this.filter)) {
                    // @todo: check for array and use 'in array'
                    okay = okay && (row[key] === value);
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

        table.toArray()
            .then(rows => this.template.render({rows: rows, globals: this.globalsValue}))
            .then(html => this.element.innerHTML = html);

    }
}

async function loadData(url) {
    console.log('fetching ' + url);
    const response = await fetch(url);
    const contentType = response.headers.get('Content-Type');
    // console.log(contentType, response.headers.forEach( (v,k) => console.log(k,v)));
    // @todo: fetch all pages
    // add the id!

    return await response.json().then(data => data['hydra:member'])
}

