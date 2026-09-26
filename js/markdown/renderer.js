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
    });

    // CommonMark can reject **「日本語」**が when a closing punctuation mark
    // touches the delimiter and another Japanese character follows it. This
    // narrow fallback runs only for that boundary (and whitespace before the
    // closing delimiter); all other emphasis stays with Markdown-It's rule.
    md.inline.ruler.before('emphasis', 'japanese_strong_boundary', (state, silent) => {
        const start = state.pos;
        if (state.src.slice(start, start + 2) !== '**') return false;
        if (!state.src[start + 2] || /\s/.test(state.src[start + 2])) return false;

        let end = start + 2;
        while ((end = state.src.indexOf('**', end)) !== -1) {
            if (end > start + 2 && state.src[end - 1] !== '\\') break;
            end += 2;
        }
        if (end === -1) return false;

        const rawContent = state.src.slice(start + 2, end);
        if (rawContent.includes('\n')) return false;
        const content = rawContent.replace(/[\t \u3000]+$/, '');
        if (!content) return false;

        const nextCharacter = state.src[end + 2] || '';
        const hasTrailingWhitespace = content.length < rawContent.length;
        const hasJapanesePunctuationBoundary = Boolean(nextCharacter)
            && /\p{P}$/u.test(content)
            && !/[\s\p{P}]/u.test(nextCharacter);
        if (!hasTrailingWhitespace && !hasJapanesePunctuationBoundary) return false;

        if (!silent) {
            const open = state.push('strong_open', 'strong', 1);
            open.markup = '**';
            state.md.inline.parse(content, state.md, state.env, state.tokens);
            const close = state.push('strong_close', 'strong', -1);
            close.markup = '**';

            if (content.length < rawContent.length) {
                const whitespace = state.push('text', '', 0);
                whitespace.content = rawContent.slice(content.length);
            }
        }

        state.pos = end + 2;
        return true;
    });

    md.core.ruler.push('repository_heading_ids', (state) => {
        const slugCounts = new Map();
        state.tokens.forEach((token, index) => {
            if (token.type !== 'heading_open') return;
            const text = state.tokens[index + 1]?.content || '';
            const baseSlug = text
                .toLocaleLowerCase()
                .trim()
                .replace(/[^\p{L}\p{N}\s_-]/gu, '')
                .replace(/[\s_]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'section';
            const count = slugCounts.get(baseSlug) || 0;
            slugCounts.set(baseSlug, count + 1);
            token.attrSet('id', count ? `${baseSlug}-${count}` : baseSlug);
        });
    });

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

/**
 * Enable TeX parsing after KaTeX and markdown-it-texmath have been loaded.
 */
export function enableMathRendering(md) {
    if (md.__mathRenderingEnabled || !window.texmath || !window.katex) return;
    md.use(window.texmath, { engine: window.katex, delimiters: 'dollars' });
    md.__mathRenderingEnabled = true;
}
