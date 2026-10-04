/**
 * `marked` is optional. This module is loaded by the page's JavaScript entry, so a static
 * `import { marked } from 'marked'` made a missing importmap pin ("Failed to resolve module specifier")
 * abort the whole entry: no Stimulus, no Tabler dropdowns, nothing. Now the import is attempted at load
 * time and, when it is not in the importmap, markdown_to_html shows the text with a notice instead.
 *
 * (The specifier is held in a variable on purpose: AssetMapper treats a literal `import('marked')` as a
 * hard dependency and fails the page when it is not mapped.)
 */
let marked = null;
try {
    const specifier = 'marked';
    ({ marked } = await import(specifier));
} catch {
    console.warn('js-twig-bundle: "marked" is not in the importmap, so markdown_to_html shows plain text. Run: php bin/console importmap:require marked');
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const NOTICE = '<p class="text-warning small mb-1">Import <code>marked</code> to see this as markdown: <code>php bin/console importmap:require marked</code></p>';

/**
 * Register the `markdown_to_html` Twig filter on a twig-browser engine.
 * Mirrors the server-side `|markdown` filter (League\CommonMark) so AI-generated
 * prose (observations, summaries) renders the same whether the block is compiled
 * server-side or re-rendered client-side by js-twig-bundle.
 */
export function installMarkdownFilter(engine) {
    engine.registerFilter('markdown_to_html', (value) => {
        const text = String(value ?? '');
        return marked
            ? marked.parse(text)
            : `${NOTICE}<div style="white-space: pre-wrap">${escapeHtml(text)}</div>`;
    });
    return engine;
}
