import { expect, test } from '@playwright/test';

const inviteCode = process.env.TEST_INVITE_CODE ?? 'test-invite-code-1234';

test('360px participant registration, logout, and returning login', async ({ page }) => {
  test.skip(!process.env.TEST_AVATAR_NICKNAME, '활성 테스트 프로필의 TEST_AVATAR_NICKNAME이 필요합니다.');
  await page.setViewportSize({ width: 360, height: 800 });
  const nickname = process.env.TEST_AVATAR_NICKNAME!;

  await page.goto('/');
  await page.getByRole('link', { name: '새로 입장하기' }).click();
  await page.getByLabel('초대 코드').fill(inviteCode);
  await page.getByRole('button', { name: '초대 코드 확인' }).click();
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('6자리 PIN', { exact: true }).fill('123456');
  await page.getByLabel('PIN 확인').fill('123456');
  await page.getByRole('button', { name: '캐릭터 만나기' }).click();

  await expect(page).toHaveURL(/\/lobby/);
  await expect(page.getByRole('heading', { name: `${nickname}님의 로비` })).toBeVisible();
  await expect(page.getByText(/PLAYER READY/)).toBeVisible({ timeout: 7000 });
  const avatarLabel = await page.getByRole('img').getAttribute('alt');

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('초대 코드').fill(inviteCode);
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('6자리 PIN').fill('123456');
  await page.getByRole('button', { name: '로비로 돌아가기' }).click();

  await expect(page).toHaveURL(/\/lobby/);
  await expect(page.getByRole('img')).toHaveAttribute('alt', avatarLabel!);
});
