import { expect, test, type Browser } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const inviteCode = process.env.E2E_INVITE_CODE ?? process.env.TEST_INVITE_CODE ?? 'test-invite-code-1234';
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? 'host';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'a-test-admin-password';
const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const runSuffix = `${Date.now()}`.slice(-7);
const initialParticipants = [
  { nickname: `픽셀고양이${runSuffix}`, content: '우리가 함께 버그를 잡던 밤' },
  { nickname: `자바스크립트요정${runSuffix}`, content: '서로의 코드를 보며\n웃었던 순간 ✨' },
  { nickname: `리액트탐험가${runSuffix}`, content: 'https://example.com/our-third-anniversary' },
  { nickname: `CSS마법사${runSuffix}` },
];

async function submitParticipantAnswer(browser: Browser, nickname: string, content?: string) {
  const context = await browser.newContext({ baseURL: appBaseUrl });
  const page = await context.newPage();
  await page.goto('/join');
  await page.getByLabel('초대 코드').fill(inviteCode);
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('6자리 PIN', { exact: true }).fill('123456');
  await page.getByLabel('PIN 확인').fill('123456');
  await page.getByRole('button', { name: '캐릭터 만나기' }).click();
  await expect(page).toHaveURL(/\/lobby/);

  if (content) {
    await page.getByRole('link', { name: '3주년 기록 남기기' }).click();
    await page.getByLabel('나의 3주년 답변').fill(content);
    await page.getByRole('button', { name: '답변 저장' }).click();
    await expect(page.getByText('저장했어요.')).toBeVisible();
  }
  await context.close();
}

async function submitExistingParticipantAnswer(browser: Browser, nickname: string, content: string) {
  const context = await browser.newContext({ baseURL: appBaseUrl });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel('6자리 PIN', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '로비로 돌아가기' }).click();
  await expect(page).toHaveURL(/\/lobby/);
  await page.getByRole('link', { name: /3주년 기록 (남기기|수정하기)/ }).click();
  await page.getByLabel('나의 3주년 답변').fill(content);
  await page.getByRole('button', { name: '답변 저장' }).click();
  await expect(page.getByText('저장했어요.')).toBeVisible();
  await context.close();
}

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('관리자 아이디').fill(adminUsername);
  await page.getByLabel('관리자 비밀번호').fill(adminPassword);
  await page.getByRole('button', { name: '진행자 입장' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: '답변 발표 진행하기' }).click();
  await expect(page).toHaveURL(/\/admin\/presenter/);
}

test('host checks submission status, presents a random answer anonymously, then reveals its author', async ({ browser, page }) => {
  for (const participant of initialParticipants) {
    await submitParticipantAnswer(browser, participant.nickname, participant.content);
  }

  await loginAsAdmin(page);

  await expect(page.getByText('전체 4명', { exact: true })).toBeVisible();
  await expect(page.getByText('제출 3명', { exact: true })).toBeVisible();
  await expect(page.getByText('미제출 1명', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '무작위 답변 공개' }).click();
  const currentSlide = page.getByTestId('presenter-current-slide');
  const currentAnswer = currentSlide.getByTestId('presenter-current-answer');
  await expect(currentAnswer).toBeVisible();
  const selectedContent = await currentAnswer.textContent();
  expect(initialParticipants.slice(0, 3).some(({ content }) => content === selectedContent?.trim())).toBe(true);
  for (const { nickname } of initialParticipants.slice(0, 3)) {
    await expect(currentSlide.getByText(nickname, { exact: true })).not.toBeVisible();
  }
  await expect(page.getByText('익명으로 공개 중')).toBeVisible();

  await page.getByRole('button', { name: '작성자 공개' }).click();
  await expect(page.getByText('작성자 공개됨')).toBeVisible();
  const revealedNames = await Promise.all(initialParticipants.slice(0, 3).map(async ({ nickname }) =>
    currentSlide.getByText(nickname, { exact: true }).isVisible()));
  expect(revealedNames.filter(Boolean)).toHaveLength(1);

  const controllerResponse = await page.request.get('/api/admin/presentation');
  const projectorResponse = await page.request.get('/api/admin/presentation/screen');
  const controller = await controllerResponse.json();
  const projector = await projectorResponse.json();
  expect(controllerResponse.ok()).toBe(true);
  expect(projectorResponse.ok()).toBe(true);
  expect(projector.slide.author.avatar).toEqual(controller.currentSlide.author.avatar);
});

test('host exhausts 30 answers once, navigates, republishes, reloads, and receives a late submission', async ({ browser, page }) => {
  test.setTimeout(120_000);
  const extraParticipants = Array.from({ length: 26 }, (_, index) => ({
    nickname: `추억수집가${runSuffix}-${String(index + 1).padStart(2, '0')}`,
    content: `추억 번호 ${String(index + 4).padStart(2, '0')}`,
  }));
  for (const participant of extraParticipants) {
    await submitParticipantAnswer(browser, participant.nickname, participant.content);
  }

  await loginAsAdmin(page);
  await expect(page.getByText('제출 29명', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '발표 기록 초기화' }).click();
  await page.getByRole('button', { name: '초기화 확인' }).click();
  await expect(page.getByTestId('presenter-current-slide').getByText('Ready?', { exact: true })).toBeVisible();

  const currentAnswer = page.getByTestId('presenter-current-answer');
  const selectedContents = new Set<string>();
  for (let index = 0; index < 29; index += 1) {
    await page.getByRole('button', { name: '무작위 답변 공개' }).click();
    await expect(page.getByText(`Memory #${index + 1}`, { exact: true })).toBeVisible();
    await expect(currentAnswer).toBeVisible();
    const content = (await currentAnswer.textContent())?.trim();
    expect(content).toBeTruthy();
    expect(selectedContents.has(content!)).toBe(false);
    selectedContents.add(content!);
  }
  expect(selectedContents.size).toBe(29);
  await expect(page.getByText('모든 답변을 공개했어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '무작위 답변 공개' })).toBeDisabled();

  const lastContent = (await currentAnswer.textContent())?.trim();
  await page.getByRole('button', { name: '이전 답변' }).click();
  await expect(currentAnswer).not.toHaveText(lastContent!);
  const previousContent = (await currentAnswer.textContent())?.trim();
  await page.getByRole('button', { name: '다음 답변' }).click();
  await expect(currentAnswer).toHaveText(lastContent!);

  const firstNickname = initialParticipants[0].nickname;
  const firstAnswerButton = page.getByRole('button', { name: `${firstNickname} 답변 공개` });
  const firstAnswerStatus = await firstAnswerButton
    .locator('xpath=ancestor::li')
    .locator('span')
    .filter({ hasText: '공개 완료' })
    .textContent();
  const firstPresentationOrder = firstAnswerStatus?.match(/^(\d+)번째/)?.[1];
  expect(firstPresentationOrder).toBeTruthy();
  await firstAnswerButton.click();
  await expect(currentAnswer).toHaveText(initialParticipants[0].content!);
  await expect(page.getByText(`Memory #${firstPresentationOrder}`, { exact: true })).toBeVisible();
  expect(previousContent).toBeTruthy();

  await page.reload();
  await expect(currentAnswer).toHaveText(initialParticipants[0].content!);
  await expect(page.getByText(`Memory #${firstPresentationOrder}`, { exact: true })).toBeVisible();
  await expect(page.getByText('익명으로 공개 중')).toBeVisible();

  const lateContent = '마지막에 도착한 서른 번째 추억';
  await submitExistingParticipantAnswer(browser, initialParticipants[3].nickname, lateContent);
  await expect(page.getByText('제출 30명', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(lateContent, { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: '무작위 답변 공개' })).toBeEnabled();
  await page.getByRole('button', { name: '무작위 답변 공개' }).click();
  await expect(currentAnswer).toHaveText(lateContent);
  expect(selectedContents.has(lateContent)).toBe(false);
});

test('projector follows keyboard-driven changes, preserves a long slide offline, and stops after session expiry', async ({ browser, context, page }) => {
  test.setTimeout(60_000);
  const contentPrefix = '줄바꿈 다음 줄\nhttps://example.com/third-anniversary/a-very-long-unbroken-path\n이모지 🚀✨\n';
  const boundaryContent = `${contentPrefix}${'가'.repeat(1_000 - contentPrefix.length)}`;
  expect(boundaryContent).toHaveLength(1_000);
  await submitExistingParticipantAnswer(
    browser,
    initialParticipants[0].nickname,
    boundaryContent,
  );

  await loginAsAdmin(page);
  await page.getByRole('button', { name: '발표 기록 초기화' }).click();
  await page.getByRole('button', { name: '초기화 확인' }).click();

  const screenLink = page.getByRole('link', { name: '발표 화면 새 창으로 열기' });
  await screenLink.focus();
  await expect(screenLink).toBeFocused();
  const focusOutline = await screenLink.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).outlineWidth));
  expect(focusOutline).toBeGreaterThanOrEqual(3);

  const popupPromise = page.waitForEvent('popup');
  await screenLink.press('Enter');
  const projector = await popupPromise;
  await projector.waitForLoadState('domcontentloaded');
  await expect(projector).toHaveURL(/\/admin\/presenter\/screen/);
  await expect(projector.getByText('다음 이야기를 기다리고 있어요.')).toBeVisible();

  const directAnswer = page.getByRole('button', {
    name: `${initialParticipants[0].nickname} 답변 공개`,
  });
  await directAnswer.focus();
  await directAnswer.press('Enter');

  const projectorSlide = projector.getByTestId('presentation-screen-slide');
  const projectorAnswer = projectorSlide.locator('.presentation-answer');
  await expect(projectorAnswer).toHaveText(boundaryContent, { timeout: 5_000 });
  await expect(projectorSlide.getByText(initialParticipants[0].nickname, { exact: true })).toHaveCount(0);
  expect(await projector.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await projectorAnswer.evaluate((element) => ({
    whiteSpace: getComputedStyle(element).whiteSpace,
    overflowWrap: getComputedStyle(element).overflowWrap,
    text: element.textContent,
  }))).toMatchObject({
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    text: boundaryContent,
  });

  const revealButton = page.getByRole('button', { name: '작성자 공개' });
  await revealButton.focus();
  await revealButton.press('Enter');
  await expect(projectorSlide.getByText(initialParticipants[0].nickname, { exact: true })).toBeVisible({ timeout: 5_000 });

  const randomButton = page.getByRole('button', { name: '무작위 답변 공개' });
  await randomButton.focus();
  await randomButton.press('Enter');
  await expect(projectorAnswer).not.toHaveText(boundaryContent, { timeout: 5_000 });
  const secondContent = await projectorAnswer.textContent();
  expect(secondContent).toBeTruthy();

  const previousButton = page.getByRole('button', { name: '이전 답변' });
  await previousButton.focus();
  await previousButton.press('Enter');
  await expect(projectorAnswer).toHaveText(boundaryContent, { timeout: 5_000 });
  const nextButton = page.getByRole('button', { name: '다음 답변' });
  await nextButton.focus();
  await nextButton.press('Enter');
  await expect(projectorAnswer).toHaveText(secondContent!, { timeout: 5_000 });

  await context.setOffline(true);
  await expect(projector.getByText('연결이 잠시 끊겼어요.')).toBeVisible({ timeout: 5_000 });
  await expect(projectorAnswer).toHaveText(secondContent!);
  await context.setOffline(false);
  await expect(projector.getByLabel('발표 화면 연결됨')).toBeVisible({ timeout: 5_000 });
  await expect(projectorAnswer).toHaveText(secondContent!);

  await context.clearCookies();
  await expect(projector.getByRole('heading', { name: '진행자 로그인이 만료됐어요' })).toBeVisible({ timeout: 5_000 });
  await expect(projector.getByRole('link', { name: '진행자 다시 로그인' })).toBeVisible();
  await expect(projector.locator('body')).not.toContainText(boundaryContent);
});
