// Run: node --import ./assets/test/routes-loader.mjs --test assets/test/
// (from bu/js-twig-bundle). Fixture: fixtures/routes.json, built by fixtures/build-routes.php.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { path, generate } = await import('../routing.js');

test('static routes', () => {
  assert.equal(path('home'), '/');
  assert.equal(path('about'), '/about');
});

test('required parameter', () => {
  assert.equal(path('product_show', { id: 42 }), '/product/42');
});

test('missing required parameter throws', () => {
  assert.throws(() => path('product_show'), /requires the parameter "id"/);
});

test('optional trailing parameter with its default is omitted', () => {
  assert.equal(path('blog_list'), '/blog');
  assert.equal(path('blog_list', { page: 1 }), '/blog');
  assert.equal(path('blog_list', { page: 3 }), '/blog/3');
});

test('defaults fill parameters that are not trailing', () => {
  assert.equal(path('post_show', { slug: 'hello' }), '/en/post/hello');
  assert.equal(path('post_show', { _locale: 'fr', slug: 'bonjour' }), '/fr/post/bonjour');
});

test('extra parameters become the query string', () => {
  assert.equal(path('about', { q: 'a b', page: 2 }), '/about?q=a+b&page=2');
  assert.equal(
    path('about', { tags: ['x', 'y'], f: { color: 'red' } }),
    '/about?tags%5B%5D=x&tags%5B%5D=y&f%5Bcolor%5D=red',
  );
});

test('values are URL-encoded, slashes kept', () => {
  assert.equal(path('post_show', { slug: 'a b/c' }), '/en/post/a%20b/c');
});

test('absolute URLs use the dumped scheme and host', () => {
  assert.equal(path('about', {}, true), 'http://example.com/about');
});

test('a _scheme requirement forces that scheme', () => {
  assert.equal(path('secure'), 'https://example.com/secure');
});

test('route schemes force that scheme', () => {
  assert.equal(path('secure_schemes'), 'https://example.com/checkout');
});

test('unknown route throws', () => {
  assert.throws(() => path('nope'), /The route "nope" does not exist/);
});

test('generate() is path() with an absolute URL', () => {
  assert.equal(generate('product_show', { id: 7 }), 'http://example.com/product/7');
});

test('base_url prefixes every path', async () => {
  const { path: basePath } = await import('../routing.js?base_url=/app');
  assert.equal(basePath('about'), '/app/about');
  assert.equal(basePath('product_show', { id: 1 }, true), 'http://example.com/app/product/1');
});
