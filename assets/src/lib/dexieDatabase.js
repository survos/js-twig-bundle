import Dexie from 'dexie';

class DbUtilities {
    constructor(config) {
        this.config = config;
        //hard set version to 1 , and local to en
        let version = 1;
        let local = 'es';
        //prepare db from config
        //alert('config.database: ' + JSON.stringify(config.database));
        let db = new Dexie(config.database);
        db.version(version).stores(this.convertArrayToObject(config.stores));
        //call db connection
        this.db = db;
        window.db = db;
        db.open().then(() => {
            //this.initDatabase();
        }).catch(err => {
            console.error('Failed to connect to database');
        });
        this.local = local;
        //if dataProgress element is present bind gauge to it
        let dataProgress = document.getElementById('dataProgress');
        var gauge = app.gauge.create({
            el: dataProgress,
            value: 0,
            valueText: '0%',
            valueTextColor: '#ff9800',
            borderColor: '#ff9800',
            type: 'circle',
            labelText: 'Loading Data ...',
            on: {
                beforeDestroy: function () {
                    console.log('Gauge will be destroyed')
                }
            }
        });
        this.gauge = gauge;
    }

    convertArrayToObject(array, key) {
        if (!array) {
            return {};
        }
        return array.reduce((acc, curr) => {
            acc[curr.name] = curr.schema;
            return acc;
        }, {});
    }

    async initDatabase() {
        this.populateEmptyTables(this.config.stores);
    }

    async populateEmptyTables(tables) {
        let index = 1;
        for (let table of tables) {
            //alert('table: ' + table.name);
            await this.syncTable(table.name, table.url);
            //sleep for 1 second
            
            //set gauge value
            let value = Math.round((index / tables.length) * 100) / 100;
            //value should be 2 decimal places
            value = value.toFixed(2);
            //alert('value: ' + value);
            this.gauge.update({
                value: value,
                valueText: (value * 100) + '%'
            });
            //alert('value: ' + value);
            await new Promise(resolve => setTimeout(resolve, 600));
            index++;
        }
        //when done , hide .page-content
        let pageContent = document.querySelector('.page-content');
        //remove page-content
        pageContent.remove();
        //click on first .tab-link
        let tabLink = document.querySelector('.tab-link');
        tabLink.click();
    }

    async syncTable(table , url) {
        table = table || null;
        if (table) {
            let count = await this.db[table].count();
            if (count === 0) {
                this.fetchTable(table, url);
            }
        }
    }

    async fetchTable(table, url) {
        //temp : replace http with https in next url
        url = url.replace('http://', 'https://');
        //replace local in url
        url = url.replace('{local}', this.local);
        let res = await fetch(url);
        let data = await res.json();
        if (data.member.length > 0) {
            data.member.forEach(row => {
                this.db[table].add(row);
            });
            if (data.view && data.view.next) {
                await this.fetchTable(table, data.view.next); // Fetch next page
            }
        }
    }

    async isPopulated(table) {
        let count = await this.db[table].count();
        return count > 0;
    }
}

export { DbUtilities };