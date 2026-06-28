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
