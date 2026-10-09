// Node loader hooks standing in for AssetMapper: routing.js imports './routes.json'
// and awaits it, because AssetMapper's JSON loader resolves to a promise. Here that
// import is served from fixtures/routes.json, wrapped the same way. A `?base_url=`
// query on the routing.js URL overrides base_url, so a test can load a second copy.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const FIXTURE = new URL('./fixtures/routes.json', import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './routes.json' && context.parentURL?.includes('/assets/routing.js')) {
      return { url: FIXTURE.href + new URL(context.parentURL).search, format: 'module', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(FIXTURE.href)) {
      const data = JSON.parse(readFileSync(FIXTURE, 'utf8'));
      const baseUrl = new URL(url).searchParams.get('base_url');
      if (baseUrl !== null) data.base_url = baseUrl;
      return { format: 'module', source: `export default Promise.resolve(${JSON.stringify(data)});`, shortCircuit: true };
    }
    return next(url, context);
  },
});
