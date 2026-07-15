declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it';

  const texmath: MarkdownIt.PluginWithOptions<{
    delimiters?: string;
    engine?: unknown;
  }>;

  export default texmath;
}
