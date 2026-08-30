import { expect, test, type Locator, type Page } from '@playwright/test';

const inviteCode = process.env.TEST_INVITE_CODE ?? 'test-invite-code-1234';

async function expectKeyboardFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  const focusStyle = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineColor: style.outlineColor,
    };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(focusStyle.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
}

async function expectTouchTargets(page: Page) {
  const tooSmall = await page.locator('a, button, input, textarea, summary').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      return rect.width >= 44 && rect.height >= 44
        ? []
        : [{
            name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }];
    }),
  );
  expect(tooSmall).toEqual([]);
}

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const value = hex.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((offset) => channel(Number.parseInt(value.slice(offset, offset + 2), 16)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('360px keyboard-only participant flow keeps focus visible and announces saves', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const nickname = `접근성${`${Date.now()}`.slice(-9)}`;

  await page.goto('/');
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Tab');
  const joinLink = page.getByRole('link', { name: '새로 입장하기' });
  await expectKeyboardFocus(joinLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/join/);

  const inviteInput = page.getByLabel('초대 코드');
  await page.keyboard.press('Tab');
  await expectKeyboardFocus(inviteInput);
  await page.keyboard.type(inviteCode);
  await page.keyboard.press('Tab');
  await page.keyboard.type(nickname);
  await page.keyboard.press('Tab');
  await page.keyboard.type('123456');
  await page.keyboard.press('Tab');
  await page.keyboard.type('123456');
  await page.keyboard.press('Tab');
  const registerButton = page.getByRole('button', { name: '캐릭터 만나기' });
  await expectKeyboardFocus(registerButton);
  await expectTouchTargets(page);
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/lobby/);
  await page.keyboard.press('Tab');
  const memoryLink = page.getByRole('link', { name: '3주년 기록 남기기' });
  await expectKeyboardFocus(memoryLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/memory/);

  const answer = page.getByLabel('나의 3주년 답변');
  await page.keyboard.press('Tab');
  await expectKeyboardFocus(answer);
  await page.keyboard.type('키보드만으로 남긴 세 번째 생일의 기억');
  await page.keyboard.press('Tab');
  const saveButton = page.getByRole('button', { name: '답변 저장' });
  await expectKeyboardFocus(saveButton);
  await page.keyboard.press('Enter');

  const saveStatus = page.getByRole('status');
  await expect(saveStatus).toHaveAttribute('aria-live', 'polite');
  await expect(saveStatus).toContainText('저장했어요.');
  await expectTouchTargets(page);
  await expectNoHorizontalOverflow(page);
});

test('forms expose meaningful labels and live status regions', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/join');

  for (const name of ['초대 코드', '닉네임', '6자리 PIN', 'PIN 확인']) {
    await expect(page.getByLabel(name, { exact: true })).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: '캐릭터 만나기' })).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite');
});

test('retro palette keeps text and UI boundaries above contrast thresholds', async ({ page }) => {
  await page.goto('/');
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      ['panel', 'border', 'ink', 'muted', 'yellow', 'pink', 'mint', 'sky', 'danger']
        .map((name) => [name, style.getPropertyValue(`--${name}`).trim()]),
    );
  });

  for (const token of ['ink', 'muted', 'yellow', 'pink', 'mint', 'sky', 'danger']) {
    expect(contrast(tokens[token], tokens.panel), `${token} text on panel`).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(tokens.border, tokens.panel), 'panel and field boundaries').toBeGreaterThanOrEqual(3);
});

test('prefers-reduced-motion disables animation, transitions, and smooth scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const motion = await page.getByRole('link', { name: '새로 입장하기' }).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      transitionDuration: style.transitionDuration,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });
  expect(motion.animationName).toBe('none');
  expect(motion.animationDuration).toBe('0s');
  expect(motion.transitionDuration).toBe('0s');
  expect(motion.scrollBehavior).toBe('auto');
});
