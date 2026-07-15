import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './renderer';

describe('renderMarkdown', () => {
  it('renders task checkboxes and list markers as semantic HTML', () => {
    const html = renderMarkdown('- [x] 完了\n- [ ] 未完了\n\n1. 第一\n2. 第二');

    expect(html).toContain('<ul');
    expect(html).toContain('<ol>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('renders math with a visible KaTeX wrapper', () => {
    const html = renderMarkdown('$$x^2 + y^2 = z^2$$');

    expect(html).toContain('katex');
    expect(html).toContain('x');
  });
});
