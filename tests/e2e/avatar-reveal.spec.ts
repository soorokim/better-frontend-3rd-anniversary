import { expect, test } from '@playwright/test';

const inviteCode = process.env.TEST_INVITE_CODE ?? 'test-invite-code-1234';

test('approved registration reveals locally, refreshes without duplication, and returns the same final profile', async ({ page }) => {
  test.skip(!process.env.TEST_REVEAL_AVATAR_NICKNAME, '공개 연출용 미선점 활성 테스트 프로필이 필요합니다.');
  const nickname = process.env.TEST_REVEAL_AVATAR_NICKNAME!;
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/join');
  await page.getByLabel('초대 코드').fill(inviteCode);
  await page.getByRole('button', { name: '초대 코드 확인' }).click();
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('6자리 PIN', { exact: true }).fill('123456');
  await page.getByLabel('PIN 확인').fill('123456');
  const submittedAt = Date.now();
  await page.getByRole('button', { name: '캐릭터 만나기' }).click();
  await expect(page.getByText(/하는 중/).first()).toBeVisible({ timeout: 1000 });
  await expect(page.getByText(/PLAYER READY/)).toBeVisible({ timeout: 7000 });
  expect(Date.now() - submittedAt).toBeLessThanOrEqual(7000);
  const card = page.getByRole('button', { name: /개발자 카드/ });
  const finalText = await card.textContent();
  await page.reload();
  await expect(page.getByText('$ initializing player...')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /개발자 카드/ })).toHaveText(finalText!);
});

test('reduced motion shows the stored result without rapid candidate changes', async ({ page }) => {
  test.skip(!process.env.TEST_REDUCED_MOTION_PARTICIPANT_PATH, '로그인된 reduced-motion storageState가 필요합니다.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.TEST_REDUCED_MOTION_PARTICIPANT_PATH!);
  await expect(page.getByText(/PLAYER READY/)).toBeVisible({ timeout: 1000 });
});
