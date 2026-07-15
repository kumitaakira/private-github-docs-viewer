import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryProfileModal } from './RepositoryProfileModal';

describe('RepositoryProfileModal', () => {
  it('toggles Personal Access Token visibility and submits form values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<RepositoryProfileModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    const repo = screen.getByLabelText(/対象リポジトリ/);
    const token = screen.getByLabelText(/Personal Access Token/) as HTMLInputElement;

    await user.type(screen.getByLabelText(/表示名/), '院試資料');
    await user.type(repo, 'example-owner/example-docs');
    await user.type(token, 'dummy-token');

    expect(token.type).toBe('password');
    await user.click(screen.getByTitle('トークンを表示'));
    expect(token.type).toBe('text');
    expect(screen.getByTitle('トークンを隠す')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存して開く' }));

    expect(onSubmit).toHaveBeenCalledWith(
      {
        cachePdfBlobs: false,
        displayName: '院試資料',
        repo: 'example-owner/example-docs',
        rootPath: '',
        token: 'dummy-token',
      },
      expect.anything(),
    );
  });
});
