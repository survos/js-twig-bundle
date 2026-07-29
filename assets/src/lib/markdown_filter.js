import { marked } from 'marked';

/**
 * Register the `markdown_to_html` Twig filter on a twig-browser engine.
 * Mirrors the server-side `|markdown` filter (League\CommonMark) so AI-generated
 * prose (observations, summaries) renders the same whether the block is compiled
 * server-side or re-rendered client-side by js-twig-bundle.
 */
export function installMarkdownFilter(engine) {
    engine.registerFilter('markdown_to_html', (value) => marked.parse(String(value ?? '')));
    return engine;
}
