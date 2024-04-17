import { Controller } from '@hotwired/stimulus';

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
        schema: Object,
        version: Number,
        store: String,
        filter: {
            type: String,
            default: '{}'
        }, // {status: 'queued'}
        // order: Object // e.g. {dateAdded: 'DESC'} (could be array?)
    }

    connect() {
        this.db = new Dexie(this.dbNameValue);
        this.db.version(this.versionValue).stores(this.schemaValue);
        this.db.open();

        console.warn("hi from " + this.identifier+ ' using dbName: ' + this.dbNameValue + '/' + this.storeValue);
        // console.error(this.filterValue);
        // compile the template
        this.template = Twig.twig({
            data: this.twigTemplateValue
        });
        this.filter = this.filterValue ? JSON.parse(this.filterValue): false;
        this.contentConnected();

        if (this.refreshEventValue) {
            document.addEventListener(this.refreshEventValue, ( e => {
                // console.log('i heard an event! ' + e.type);
                this.contentConnected();
            }));
        }


    }

    // because this can be loaded by Turbo or Onsen
    async contentConnected()
    {
        let table = this.db.table(this.storeValue);
        // if (this.filter) {
        //     this.filter = {'owned': true};
        //     table = table.where({owned: true}).toArray().then(rows => console.log(rows)).catch(e => console.error(e));
        // }
        // // console.log(table);
        // return;

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
            .then( rows => this.template.render({rows: rows}))
            .then( html => this.element.innerHTML = html);

    }
}
