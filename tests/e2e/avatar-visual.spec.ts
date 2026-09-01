import { expect, test } from '@playwright/test';

test('pilot review requires an existing admin session', async ({ page }) => {
  await page.goto('/admin/avatar-review?mode=pilot');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('the avatar lab renders DiceBear samples without horizontal overflow at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/avatar-lab');

  await expect(page.locator('[data-avatar-engine="dicebear-open-peeps-bold-pop-v1"]')).toHaveCount(28);
  expect(await page.locator('[data-avatar-layer="item"]').count()).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
