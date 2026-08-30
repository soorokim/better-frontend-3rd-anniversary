import { expect, test } from '@playwright/test';

const inviteCode = process.env.TEST_INVITE_CODE ?? 'test-invite-code-1234';

test('360px answer save, returning edit, and failed-save recovery', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const nickname = `기록자-${Date.now()}`;

  await page.goto('/join');
  await page.getByLabel('초대 코드').fill(inviteCode);
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('6자리 PIN', { exact: true }).fill('123456');
  await page.getByLabel('PIN 확인').fill('123456');
  await page.getByRole('button', { name: '캐릭터 만나기' }).click();
  await page.getByRole('link', { name: '3주년 기록 남기기' }).click();

  const answer = page.getByLabel('나의 3주년 답변');
  await answer.fill('우리의 첫 번째 기억');
  await page.getByRole('button', { name: '답변 저장' }).click();
  await expect(page.getByText('저장했어요.')).toBeVisible();

  await page.reload();
  await expect(answer).toHaveValue('우리의 첫 번째 기억');
  await page.getByRole('link', { name: '로비로 돌아가기' }).click();
  await expect(page.getByText('기록 완료')).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.getByLabel('초대 코드').fill(inviteCode);
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('6자리 PIN').fill('123456');
  await page.getByRole('button', { name: '로비로 돌아가기' }).click();
  await page.getByRole('link', { name: '3주년 기록 수정하기' }).click();

  await answer.fill('다시 들어와 수정한 기억');
  await page.getByRole('button', { name: '답변 저장' }).click();
  await expect(page.getByText('저장했어요.')).toBeVisible();

  await answer.fill('수정 중이지만 아직 저장 안 함');
  await page.route('**/api/answer/current', async (route) => {
    if (route.request().method() === 'PUT') await route.abort('failed');
    else await route.continue();
  });
  await page.getByRole('button', { name: '답변 저장' }).click();
  await expect(page.getByText('저장하지 못했어요.')).toBeVisible();
  await expect(answer).toHaveValue('수정 중이지만 아직 저장 안 함');
  await expect(page.getByText('마지막 저장본: 다시 들어와 수정한 기억')).toBeVisible();
});
