import { useMemo } from 'react';
import { renderMarkdown } from '../../infrastructure/markdown/renderer';

type MarkdownViewerProps = {
  markdown: string;
};

export function MarkdownViewer({ markdown }: MarkdownViewerProps) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  return (
    <article
      className="markdown-body mx-auto min-h-full w-full bg-white dark:bg-dracula-bg"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
