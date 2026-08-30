import { expect, test } from '@playwright/test';

test('nickname and PIN stay hidden until the invitation endpoint accepts the code', async ({ page }) => {
  await page.goto('/join');
  await expect(page.getByLabel('닉네임')).toHaveCount(0);
  await expect(page.getByLabel('6자리 PIN')).toHaveCount(0);
  await page.getByLabel('초대 코드').fill('wrong-invite-code-0000');
  await page.getByRole('button', { name: '초대 코드 확인' }).click();
  await expect(page.getByRole('status')).toContainText(/초대|입장/);
  await expect(page.getByLabel('닉네임')).toHaveCount(0);
});

test('an unknown nickname is rejected without moving to the lobby', async ({ page }) => {
  test.skip(!process.env.TEST_INVITE_CODE, '활성 프로필 배치가 있는 테스트 서버가 필요합니다.');
  await page.goto('/join');
  await page.getByLabel('초대 코드').fill(process.env.TEST_INVITE_CODE!);
  await page.getByRole('button', { name: '초대 코드 확인' }).click();
  await page.getByLabel('닉네임').fill(`미등록-${Date.now()}`);
  await page.getByLabel('6자리 PIN', { exact: true }).fill('123456');
  await page.getByLabel('PIN 확인').fill('123456');
  await page.getByRole('button', { name: '캐릭터 만나기' }).click();
  await expect(page.getByRole('status')).toContainText(/단톡방|닉네임/);
  await expect(page).toHaveURL(/\/join/);
});
