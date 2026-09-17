/**
 * Create the shared Markdown-It renderer with KaTeX and GitHub task-list support.
 *
 * @returns {import('markdown-it')}
 */
export function createMarkdownRenderer() {
    const md = window.markdownit({
        html: true,
        breaks: true,
        linkify: true,
        highlight(str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(str, { language: lang }).value;
                } catch (__) { }
            }
            return '';
        }
    }).use(window.texmath, { engine: window.katex, delimiters: 'dollars' });

    const defaultFence = md.renderer.rules.fence.bind(md.renderer.rules);
    md.renderer.rules.fence = (tokens, index, options, env, self) => {
        const language = tokens[index].info.trim().split(/\s+/)[0].toLowerCase();
        if (language !== 'mermaid') return defaultFence(tokens, index, options, env, self);

        const source = md.utils.escapeHtml(tokens[index].content.trim());
        return `<figure class="mermaid-diagram" data-mermaid-diagram>`
            + `<div class="mermaid-stage" role="button" tabindex="0" title="クリックで拡大" aria-label="Mermaid図を拡大表示"></div>`
            + `<span class="mermaid-zoom-hint material-symbols-outlined" aria-hidden="true">zoom_out_map</span>`
            + `<pre class="mermaid-source"><code>${source}</code></pre>`
            + `<figcaption class="mermaid-status" role="status"></figcaption>`
            + `</figure>`;
    };

    md.renderer.rules.table_open = () => '<div class="markdown-table-scroll"><table>\n';
    md.renderer.rules.table_close = () => '</table></div>\n';
    md.renderer.rules.th_open = (tokens, index, options, env, self) => (
        `<th${self.renderAttrs(tokens[index])}><div class="markdown-table-cell">`
    );
    md.renderer.rules.th_close = () => '</div></th>';
    md.renderer.rules.td_open = (tokens, index, options, env, self) => (
        `<td${self.renderAttrs(tokens[index])}><div class="markdown-table-cell">`
    );
    md.renderer.rules.td_close = () => '</div></td>';

    md.core.ruler.after('inline', 'github_task_lists', (state) => {
        const tokens = state.tokens;
        for (let i = 2; i < tokens.length; i++) {
            if (tokens[i].type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue;
            const firstChild = tokens[i].children && tokens[i].children[0];
            if (!firstChild || firstChild.type !== 'text') continue;

            const match = firstChild.content.match(/^\s*\[([ xX])\]\s+/);
            if (!match) continue;

            const checkbox = new firstChild.constructor('html_inline', '', 0);
            const checkedAttr = match[1].toLowerCase() === 'x' ? ' checked' : '';
            checkbox.content = `<input class="task-list-item-checkbox" type="checkbox" disabled${checkedAttr}>`;
            firstChild.content = firstChild.content.slice(match[0].length);
            tokens[i].children.unshift(checkbox);
            tokens[i - 2].attrJoin('class', 'task-list-item');
        }
    });

    return md;
}
