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
checks do not verify deployed versions. Eleven primary apps remain from the
original list.
