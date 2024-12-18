# JS Twig Bundle


Wraps https://www.jsdelivr.com/package/npm/twig and https://www.jsdelivr.com/package/npm/dexie in a Symfony UX component and provides utilties for using twig blocks in javascript.

dexie_controller needs to load a database, as well as fetch individual items and a filtered list.

* Load: /api/pokemon and populate the dexie

When rendering a template, it listens for an event (the tab or page load event), and needs to grab the data before passing it to the renderer.  For example:

* items: get all the items from a list
* saved: get items with the saved property as true
* item: look up an item by id

Of course, dexie itself doesn't know about pokemon, it only knows that there is a database.  Currently to get things like the filter, it calls app_controller (via an outlet).   This is overly complicated, all of the outlet calls should be replaced with simple CustomEvents, which app_controller (or some other javascript) can listen to.

# Brainstorming

## Load the database

when dexie controller is called, it receives a database name and a filter _for loading_.  (We will later need a dynamic filter for displaying).
This needs to be `sync` with an event emitted so that a loader can display a progress bar (at the app level).

## Displaying a list

Here's an example call to dexie.

@todo: rename templates, e.g. list_template, item_template, header_template

```twig
    <twig:dexie
        refreshEvent="items.prechange"
        type: 'list'
        :store="store"
        :globals="globals"
        :filter="{}"
        :caller="_self">
        <twig:block name="twig_template" id="end_of_template">
            <ons-list>
                {% for row in rows %}
                {% set thumb = '/media/cache/small/%s/%s'|format(row.code, row.image) %}
                <ons-list-item class="list-item" tappable
                               {{ stimulus_action('app','open_page','click', {
                                   page: 'player',
                                   store: 'items',
                                   id: row.id
                               }) }}
                >
                    <div class="top list-item__top">
                        <div class="left list-item__left">
                            <img
                                    class="ons-mobile-thumbnail" src="{{ thumb }}"
                                 alt="{{ thumb }}"/>
                        </div>
                        <div class="xcenter xlist-item__center">
                                <h3>
                                    {{ row.label }}
                                </h3>
                            <div style="margin: 4px">
                            {{ row.size }}

                            </div>
                        </div>
                        <div class="right list-item__right">
                            {{ row.year }}
                            <br />
                            ${{ row.price|number_format(0, ",", ".") }}
                        </div>
                    </div>
                </ons-list-item>
                {% endfor %}
            </ons-list>
            <!-- end_of_template -->
        </twig:block>

    </twig:dexie>
```

### Properties
        refreshEvent="items.prechange"
listen for this event to fire the controller

        type: 'list'
The type determines which twig templates are called and what filters are applied.

        :store="store"
The name of the database, as defined in survos_js_twig.yaml

        :globals="globals"
We can pass globals to the renderer, like icons and other values that can't be rendered directly because it's jstwig, not twig.

        :filter="{}"
The filter for loading the database (not the dynamic display)

        :caller="_self"
We need this to extract the twig templates from the source file itself.

### JSTwg Templates

The templates are defined at application level, they are rendered and then dispatch CustomEvents with the rendered values.  `type` determines what values are passed to the rendering (item, list).


