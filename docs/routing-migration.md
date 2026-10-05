# Browser routing: migrate away from FOSJsRoutingBundle

## Current contract

Install a js-twig-bundle release containing `RoutingImportCompiler` and the JSON
cache warmer (or link the current mono checkout). AssetMapper must be 7.4.20+
or 8.1.8+. Do not assume an older js-twig-bundle release has this behavior.

```js
import { path, generate } from '@survos/js-twig/routing';
const url = path('topic_tree_api', { selectedId: row.code });
```

Cache warmup writes **data**, not generated JavaScript:
`var/js_twig_bundle/generated/routes.json`. The maintained bundle runtime
`assets/routing.js` imports that data through AssetMapper's JSON promise loader.
`RoutingImportCompiler` resolves the runtime and JSON dependencies, including
Composer path symlinks. Applications need **no routing entry in importmap.php**.
The JSON file is not an entrypoint and should not be manually mapped either.

Server-rendered Twig `path()` is unchanged. Browser Twig requires the Symfony
adapter with this runtime's `path` supplied as its pathGenerator; the Survos
API Grid and tree controllers already wire that adapter.

The old JavaScript specifier `@survos/js-twig/generated/fos_routes.js` remains a
compiler compatibility alias. It is not a generated file anymore. Existing
imports can keep working, but new code must use `@survos/js-twig/routing`.
The alias does not make FOS's `Routing.setRoutingData`, global `Routing`, npm
`fos-routing`, or the FOS route endpoint compatible automatically.

## Migrate an application

1. Upgrade/link js-twig-bundle and the required Symfony AssetMapper version.
2. Inventory direct FOS use: `Routing.generate`, `Routing.setRoutingData`,
   `fos-routing`, `fos_js_routing_js`, dumped route imports, and script tags.
   Replace these with the new runtime before removing their provider. This
   compiler is an AssetMapper integration; separate Encore/Vite builds need
   an explicit integration, not just the same bare import.
3. Preserve route exposure. Route `options: ['expose' => true]` still works.
   Move any `fos_js_routing.routes_to_expose` configuration into
   `survos_js_twig.routing.routes_to_expose` before deleting the FOS config.
4. Remove manual importmap entries for `@survos/js-twig/generated/fos_routes.js`,
   `@survos/js-twig/routing`, and FOS/dump aliases after replacing their consumers.
   In particular, remove entries pointing to the old generated JS on disk.
5. Remove the FOS bundle registration, `config/routes/fos_js_routing.yaml`,
   FOS package configuration, and `fos:js-routing:dump` Composer/deploy steps.
   Remove `friendsofsymfony/jsrouting-bundle` with Composer and commit its lock
   and recipe changes. Delete obsolete tracked dumps after checking consumers.
6. Warm the cache before compiling assets, in the same environment:

   ```bash
   APP_ENV=prod php bin/console cache:clear
   APP_ENV=prod php bin/console asset-map:compile
   ```

   If clearing with `--no-warmup`, run `cache:warmup` explicitly before asset
   compilation. Rewarm after changing exposed routes in development. Do not
   commit generated cache data or bring back a separate route-dump command.
7. Verify from a clean cache: routes.json exists, the container boots without
   FOS, assets compile, and browser Twig renders a real `path('known_route')`.
   Test route parameters, query strings, and locale/absolute URLs used by that
   application. A server-rendered Twig link alone does not test JS routing.

## Troubleshooting

- **Missing generated fos_routes.js:** remove the old importmap path entry;
  don't recreate that file. The compiler compatibility alias handles imports.
- **Unknown exposed route:** check `expose` / `routes_to_expose` and rewarm.
- **Routing module cannot resolve:** confirm the installed js-twig-bundle has
  `RoutingImportCompiler`, check AssetMapper versions, then warm and rebuild.
  Don't fix this by adding a manual generated-file importmap entry.
- **Old browser assets after migration:** rebuild production assets and refresh
  the page. Compiled public/assets can mask current development source.

## Local audit, 2026-10-04

Scope: local checkouts under `/Users/tac/sites` and `/Users/tac/tacman`, excluding
installed vendor/node_modules and generated cache. This is not a remote/deployed
application inventory. A dependency declaration is not proof of runtime use.

The following primary apps still declare FOSJsRoutingBundle and need an individual
migration and verification:

`bench`, `cue`, `depot`, `ff`, `fw7-demo`, `harvest`, `kpa`, `packages`,
`pressia`, `repo`, `showcase`, `ssai`, `zm`.

Additional declarations exist in `harvest-remote-media`, `harvest-symfony-82`,
`packages-symfony-82`, `pressia-parallel`, `mono-harvest-82`,
`mono-release-harvest-82`, and archived `deprecated/mus`. Coordinate these
checkouts with their owners rather than applying edits to parallel worktrees.

Examples requiring consumer migration: packages imports npm `fos-routing`;
pressia has its own dumped-route wrapper; cue, kpa, and showcase retain dump
scripts. Other apps also retain legacy importmap entries without a direct FOS
Composer requirement. Review those entries separately; they are not evidence
that the FOS PHP bundle is installed.

Tree-demo is the verified migration example: no FOS dependency or routing
importmap entry, routes generated by warmup, browser-rendered API Grid links,
and tests covering dependency discovery and the old import alias. Mono's demo
application dependency and API Grid's outdated Composer suggestion are removed
as part of this cleanup. The bundles use the canonical runtime import.

### Completed after the audit

Cue and zm have now had FOS removed from Composer manifests/locks, bundle and
route registration, and legacy importmap entries. Cue's dump auto-script was
removed; zm had no dump script. Both pass cache warmup, container validation,
AssetMapper compilation, and focused routing regression tests (11 and 10
assertions respectively). Cue explicitly links the current js-twig-bundle via a
Composer path repository; zm already had the local mono link. These local
checks do not verify deployed versions.


### Session handoff, 2026-10-05

Completed in this session (commit identifiers are local history references, not
proof of deployment):

| Application | Migration commit | Verification |
| --- | --- | --- |
| cue | `7af6b78` | Cache, container, assets, routing regression test |
| zm | `8b49105` | Cache, container, assets, routing regression test; later rechecked 22 exposed routes |
| showcase | `964e002` | FOS removal and grid integration; Browse/SearchBuilder followed in `4c2e5f7` |
| pressia | `6285af6` | Cache, container, 157 exposed routes and JSON import resolution |
| ssai | `f19dc327` | Cache, container, 104 exposed routes and JSON import resolution |

Pressia and ssai gained the missing grid-bundle dependency required by their
linked api-grid-bundle. ssai's AssetMapper was upgraded from 8.1.7 to 8.1.8.
Unrelated Messenger work in pressia and repository/authentication work in ssai
were deliberately left outside these commits. Both apps have their own
`docs/browser-routing.md`.

Pressia still has dormant CommonJS/Encore-era FOS consumers under `assets/js/`.
The active AssetMapper entrypoint does not import them. Reviving those pages
requires migrating their consumers, not restoring FOS or its dump command.

Showcase Browse proves SearchBuilder CSS and JavaScript loading through the
basic grid-bundle component. Columns include Composer PHP requirements,
Composer keywords, and direct runtime package dependency counts. The numeric
condition “Dependencies > 100” filtered 23 sites to 3 during verification.
Dependency-name filtering remains future work.

### JSON caching and deployment

The routing module awaits one JSON promise per document/module instance. All
`path()` calls then use the same in-memory data; grid rows do not trigger route
requests. Symfony's current JSON import implementation uses a fetch-backed
promise loader, rather than native JSON import attributes.

On full page navigation the loader runs again, but ordinary `fetch()` uses the
browser HTTP cache. This does not mean the JSON is downloaded on every page.
The JSON is compact (no pretty-printing) and its AssetMapper URL contains a
content hash, so changed route data receives a new URL. In the local Showcase
check on 2026-10-04, the fingerprinted JSON response had:

```http
Cache-Control: immutable, max-age=604800, public
Content-Type: application/json
```

Production asset compilation writes a static JSON file. Verify that the
production web server/CDN sends appropriate caching headers for `.json` assets
as well as `.js`; local headers do not establish deployed behavior. A cold cache
has a separate JSON request, and each new document parses JSON again. There was
no observed caching regression requiring a revert.

### Deferred scope

Eight apps from the original audit were not migrated by this session:
`bench`, `depot`, `ff`, `fw7-demo`, `harvest`, `kpa`, `packages`, and `repo`.
Other chats may have changed them since that audit; inspect current state first.

The user narrowed future work to active Museado sites. Local evidence suggested
`ssai`, `zm`, `bts`, and `vt`, but the complete active scope was not confirmed.
`bts` had an old `fos-routing` importmap entry without a direct PHP dependency;
its consumers still need checking. `vt` had no FOS configuration in the checked
manifest/importmap/bundle files. Whether supporting apps such as harvest,
depot, and mediary belong in this pass remains open. `foundation` was a planning
repository; deprecated `mus` is explicitly broken/archive-only and was excluded.
Do not resume a blanket migration or assume these local checks verify live sites.
