import { expect, test } from '@playwright/test';

const contextSizes = ['192', '76', '52', '80', '48'];

test('pilot review requires an existing admin session', async ({ page }) => {
  await page.goto('/admin/avatar-review?mode=pilot');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('the admin review component shows four pilot avatars in every real display size at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/avatar-lab');

  const grid = page.getByTestId('avatar-review-grid');
  await expect(grid).toHaveAttribute('data-review-mode', 'pilot');
  const cards = grid.locator('[data-pilot-case]');
  await expect(cards).toHaveCount(4);

  for (const size of contextSizes) {
    await expect(grid.locator(`[data-avatar-context-size="${size}"]`)).toHaveCount(4);
  }
  await expect(grid.locator('[data-avatar-asset-set="pixel-layers-v3"]')).toHaveCount(20);
  await expect(grid.locator('[data-avatar-phase="pilot"]')).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await expect(cards.nth(0)).toHaveScreenshot('pilot-short-small-item.png');
  await expect(cards.nth(1)).toHaveScreenshot('pilot-long-wide-item.png');
  await expect(cards.nth(2)).toHaveScreenshot('pilot-cap-tiny-item.png');
  await expect(cards.nth(3)).toHaveScreenshot('pilot-tall-large-item.png');
});
