import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import texmath from 'markdown-it-texmath';
import katex from 'katex';

const escapeHtml = new MarkdownIt().utils.escapeHtml;

const markdown: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code: string, language: string): string {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return escapeHtml(code);
  },
})
  .use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { throwOnError: false },
  })
  .use(taskLists, { enabled: false })
  .enable('table')
  .enable('strikethrough');

export function renderMarkdown(markdownText: string): string {
  return DOMPurify.sanitize(markdown.render(markdownText), {
    ADD_TAGS: [
      'math',
      'maction',
      'maligngroup',
      'malignmark',
      'menclose',
      'merror',
      'mfenced',
      'mfrac',
      'mi',
      'mlongdiv',
      'mmultiscripts',
      'mn',
      'mo',
      'mover',
      'mpadded',
      'mphantom',
      'mroot',
      'mrow',
      'ms',
      'mscarries',
      'mscarry',
      'msgroup',
      'msline',
      'mspace',
      'msqrt',
      'msrow',
      'mstyle',
      'msub',
      'msup',
      'msubsup',
      'mtable',
      'mtd',
      'mtext',
      'mtr',
      'munder',
      'munderover',
      'semantics',
      'annotation',
      'annotation-xml',
    ],
    ADD_ATTR: ['target', 'class', 'style', 'xmlns', 'display', 'type', 'checked', 'disabled'],
  });
}
