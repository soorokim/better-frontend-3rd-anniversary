import { expect, test } from '@playwright/test';

const inviteCode = process.env.E2E_INVITE_CODE ?? 'test-invite-code-1234';
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? 'host';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'a-test-admin-password';
const canonicalNickname = process.env.E2E_PROFILE_NICKNAME ?? '예시개발자';
const approvedAlias = process.env.E2E_PROFILE_ALIAS ?? '예전닉네임';

test('an approved alias recovers the same answer and avatar after an admin PIN reset', async ({ page, context }) => {
  const answer = `별칭 복구 확인 답변 ${Date.now()}`;
  await page.setViewportSize({ width: 360, height: 780 });

  await page.goto('/join');
  await page.getByLabel('초대 코드').fill(inviteCode);
  await page.getByRole('button', { name: '초대 코드 확인' }).click();
  await page.getByLabel('닉네임').fill(approvedAlias);
  await page.getByLabel('6자리 PIN').fill('123456');
  await page.getByLabel('PIN 확인').fill('123456');
  await page.getByRole('button', { name: '캐릭터 만나기' }).click();
  await expect(page).toHaveURL(/\/lobby/);
  await expect(page.getByText(`${canonicalNickname}님의 로비`)).toBeVisible();
  await expect(page.getByText('✓ PLAYER READY')).toBeVisible({ timeout: 6_000 });
  const avatarBefore = await page.getByAltText(new RegExp(`^${canonicalNickname}의 픽셀 캐릭터`))
    .getAttribute('src');

  await page.goto('/memory');
  await page.getByLabel('나의 3주년 답변').fill(answer);
  await page.getByRole('button', { name: '답변 저장' }).click();
  await expect(page.getByRole('status')).toHaveText('저장했어요.');

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel('관리자 아이디').fill(adminUsername);
  await page.getByLabel('관리자 비밀번호').fill(adminPassword);
  await page.getByRole('button', { name: '진행자 입장' }).click();
  await expect(page.getByLabel('참가자 제출 현황').getByText(canonicalNickname, { exact: true }))
    .toBeVisible();
  await page.getByRole('button', { name: `${canonicalNickname} PIN 초기화` }).click();
  await page.getByRole('button', { name: '초기화 코드 만들기' }).click();
  const code = await page.getByTestId('reset-code').textContent();
  expect(code).toMatch(/^\d{8}$/);

  await context.clearCookies();
  await page.goto('/reset-pin');
  await page.getByLabel('초대 코드').fill(inviteCode);
  await page.getByLabel('닉네임').fill(approvedAlias);
  await page.getByLabel('초기화 코드').fill(code!);
  await page.getByLabel('새 6자리 PIN').fill('654321');
  await page.getByLabel('새 PIN 확인').fill('654321');
  await page.getByRole('button', { name: '새 PIN 설정' }).click();
  await expect(page.getByText('새 PIN이 설정됐어요')).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(approvedAlias);
  await page.getByLabel('6자리 PIN').fill('123456');
  await page.getByRole('button', { name: '로비로 돌아가기' }).click();
  await expect(page.getByRole('status')).toContainText('다시 확인');
  await page.getByLabel('6자리 PIN').fill('654321');
  await page.getByRole('button', { name: '로비로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/lobby/);
  await expect(page.getByText(`${canonicalNickname}님의 로비`)).toBeVisible();
  await expect(page.getByAltText(new RegExp(`^${canonicalNickname}의 픽셀 캐릭터`)))
    .toHaveAttribute('src', avatarBefore!);

  await page.goto('/memory');
  await expect(page.getByLabel('나의 3주년 답변')).toHaveValue(answer);
});
