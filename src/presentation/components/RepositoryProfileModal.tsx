import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { RepositoryProfile, RepositoryProfileInput } from '../../domain/models';
import {
  type RepositoryProfileFormInput,
  type RepositoryProfileFormValues,
  repositoryProfileInputSchema,
} from '../../domain/schemas';
import { Icon } from './Icon';

type RepositoryProfileModalProps = {
  open: boolean;
  profile?: RepositoryProfile | null;
  onClose: () => void;
  onSubmit: (values: RepositoryProfileInput) => void;
};

export function RepositoryProfileModal({ open, profile, onClose, onSubmit }: RepositoryProfileModalProps) {
  const [showToken, setShowToken] = useState(false);
  const form = useForm<RepositoryProfileFormInput, unknown, RepositoryProfileFormValues>({
    resolver: zodResolver(repositoryProfileInputSchema),
    defaultValues: {
      displayName: '',
      repo: '',
      rootPath: '',
      token: '',
      cachePdfBlobs: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      displayName: profile?.displayName || '',
      repo: profile?.repo || '',
      rootPath: profile?.rootPath || '',
      token: profile?.token || '',
      cachePdfBlobs: Boolean(profile?.cachePdfBlobs),
    });
  }, [form, open, profile]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4 dark:bg-black/60"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-2xl dark:border-dracula-current dark:bg-dracula-sidebar"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-dracula-purple">
            {profile ? '接続先を編集' : '接続先を追加'}
          </h3>
          <button
            className="icon-btn text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-dracula-comment dark:hover:bg-dracula-current dark:hover:text-dracula-fg"
            title="閉じる"
            type="button"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600 dark:text-dracula-comment">表示名</span>
            <input
              className="w-full rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none dark:border-dracula-current dark:bg-dracula-bg dark:text-dracula-fg dark:focus:border-dracula-pink"
              placeholder="例: 大学院入試資料"
              {...form.register('displayName')}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-gray-600 dark:text-dracula-comment">
              対象リポジトリ <span className="text-red-500 dark:text-dracula-red">*</span>
            </span>
            <input
              className="w-full rounded border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none dark:border-dracula-current dark:bg-dracula-bg dark:text-dracula-fg dark:focus:border-dracula-pink"
              placeholder="例: user/repo"
              {...form.register('repo')}
            />
            {form.formState.errors.repo ? (
              <span className="mt-1 block text-xs text-red-500">{form.formState.errors.repo.message}</span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-gray-600 dark:text-dracula-comment">
              ルートパス (省略可)
            </span>
            <input
              className="w-full rounded border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none dark:border-dracula-current dark:bg-dracula-bg dark:text-dracula-fg dark:focus:border-dracula-pink"
              placeholder="例: docs"
              {...form.register('rootPath')}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-gray-600 dark:text-dracula-comment">
              Personal Access Token <span className="text-red-500 dark:text-dracula-red">*</span>
            </span>
            <span className="relative block">
              <input
                className="w-full rounded border border-gray-300 bg-gray-50 p-3 pr-11 font-mono text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none dark:border-dracula-current dark:bg-dracula-bg dark:text-dracula-fg dark:focus:border-dracula-pink"
                placeholder="github_pat_..."
                type={showToken ? 'text' : 'password'}
                {...form.register('token')}
              />
              <button
                className="icon-btn absolute right-1.5 top-1/2 !h-8 !w-8 -translate-y-1/2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-dracula-comment dark:hover:bg-dracula-current dark:hover:text-dracula-fg"
                title={showToken ? 'トークンを隠す' : 'トークンを表示'}
                type="button"
                onClick={() => setShowToken((value) => !value)}
              >
                <Icon className="text-[18px]" name={showToken ? 'visibility_off' : 'visibility'} />
              </button>
            </span>
            {form.formState.errors.token ? (
              <span className="mt-1 block text-xs text-red-500">{form.formState.errors.token.message}</span>
            ) : null}
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded border border-gray-200 bg-gray-50 p-3 dark:border-dracula-current dark:bg-dracula-bg">
            <input
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-dracula-current dark:bg-dracula-sidebar"
              type="checkbox"
              {...form.register('cachePdfBlobs')}
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-dracula-fg">
                <Icon className="text-[18px]" name="picture_as_pdf" />
                PDFを端末にキャッシュ
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-dracula-comment">
                OFF推奨。ONの場合、PCは最大100MB、スマホは最大40MBまで保存し、古いPDFから自動削除します。
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-dracula-current dark:text-dracula-comment dark:hover:bg-dracula-current dark:hover:text-dracula-fg"
            type="button"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-blue-700 dark:bg-dracula-purple dark:text-dracula-bg dark:hover:bg-[#a67cf3]"
            type="submit"
          >
            保存して開く
          </button>
        </div>
      </form>
    </div>
  );
}
