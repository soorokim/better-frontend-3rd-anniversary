import { expect, test } from '@playwright/test';

test('participant cannot enter admin and host can reset a PIN at 360px', async ({ page, context }) => {
  const suffix = `${Date.now()}`.slice(-8); const nickname = `관리복구${suffix}`;
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/join'); await page.getByLabel('초대 코드').fill(process.env.E2E_INVITE_CODE ?? 'test-invite-code-1234'); await page.getByLabel('닉네임').fill(nickname); await page.getByLabel('6자리 PIN').fill('123456'); await page.getByLabel('PIN 확인').fill('123456'); await page.getByRole('button', { name: '캐릭터 만나기' }).click();
  await expect(page).toHaveURL(/\/lobby/); await page.goto('/admin'); await expect(page).toHaveURL(/\/admin\/login/);
  await context.clearCookies(); await page.goto('/admin/login'); await page.getByLabel('관리자 아이디').fill(process.env.E2E_ADMIN_USERNAME ?? 'host'); await page.getByLabel('관리자 비밀번호').fill(process.env.E2E_ADMIN_PASSWORD ?? 'a-test-admin-password'); await page.getByRole('button', { name: '진행자 입장' }).click();
  await expect(page.getByText(nickname)).toBeVisible(); await page.getByRole('button', { name: `${nickname} PIN 초기화` }).click(); await page.getByRole('button', { name: '초기화 코드 만들기' }).click();
  const code = await page.getByTestId('reset-code').textContent(); expect(code).toMatch(/^\d{8}$/);
  await context.clearCookies(); await page.goto('/reset-pin'); await page.getByLabel('초대 코드').fill(process.env.E2E_INVITE_CODE ?? 'test-invite-code-1234'); await page.getByLabel('닉네임').fill(nickname); await page.getByLabel('초기화 코드').fill(code!); await page.getByLabel('새 6자리 PIN').fill('654321'); await page.getByLabel('새 PIN 확인').fill('654321'); await page.getByRole('button', { name: '새 PIN 설정' }).click();
  await expect(page.getByText('새 PIN이 설정됐어요')).toBeVisible(); await expect(page).not.toHaveURL(/\/lobby/);
  await page.goto('/login'); await page.getByLabel('초대 코드').fill(process.env.E2E_INVITE_CODE ?? 'test-invite-code-1234'); await page.getByLabel('닉네임').fill(nickname); await page.getByLabel('6자리 PIN').fill('123456'); await page.getByRole('button', { name: '로비로 돌아가기' }).click(); await expect(page.getByRole('status')).toContainText('다시 확인');
  await page.getByLabel('6자리 PIN').fill('654321'); await page.getByRole('button', { name: '로비로 돌아가기' }).click(); await expect(page).toHaveURL(/\/lobby/); await expect(page.getByText(`${nickname}님의 로비`)).toBeVisible();
});
