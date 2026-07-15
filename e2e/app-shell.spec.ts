import { expect, test } from '@playwright/test';

test('shows the repository setup flow on first launch', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '接続先ライブラリ' })).toBeVisible();
  await expect(page.getByTitle('閉じる')).toBeVisible();
  await expect(page.getByRole('button', { name: /追加/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '接続先を追加' })).toBeHidden();

  await page.getByRole('button', { name: /追加/ }).click();
  await expect(page.getByRole('heading', { name: '接続先を追加' })).toBeVisible();
});
