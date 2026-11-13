import { test, expect } from '@playwright/test';

const locales = [
  {
    name: 'English',
    path: '/en',
    closeLabel: 'Close chat',
    openLabel: 'Ask Nujaym — open chat',
    placeholder: 'Type your question…',
    direction: 'ltr',
  },
  {
    name: 'Arabic',
    path: '/',
    closeLabel: 'إغلاق المحادثة',
    openLabel: 'اسأل نُجَيْم — افتح المحادثة',
    placeholder: 'اكتب سؤالك…',
    direction: 'rtl',
  },
] as const;

for (const locale of locales) {
  test(`${locale.name} chat stays reachable during emulated visual viewport changes`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await page.addInitScript(() => {
      localStorage.setItem('funademy-chat-consent', 'yes');
    });
    await page.route('**/svc/chat/conversations', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [], hasFamilyAccount: false }),
    }));
    await page.goto(locale.path);
    await expect(page.locator('html')).toHaveAttribute('dir', locale.direction);
    await expect(page.getByTestId('button-open-chat')).toHaveAttribute('aria-label', locale.openLabel);

    // Provide a deterministic VisualViewport event target. This checks the
    // widget's resize/scroll response, not a physical keyboard or device.
    await page.evaluate(() => {
      const state = { height: window.innerHeight, offsetTop: 0 };
      const viewport = new EventTarget();
      Object.defineProperties(viewport, {
        height: { configurable: true, get: () => state.height },
        offsetTop: { configurable: true, get: () => state.offsetTop },
      });
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: viewport,
      });
      (window as Window & {
        setTestVisualViewport?: (height: number, offsetTop: number, event: string) => void;
      }).setTestVisualViewport = (height, offsetTop, event) => {
        state.height = height;
        state.offsetTop = offsetTop;
        viewport.dispatchEvent(new Event(event));
      };
    });

    await page.getByTestId('button-open-chat').click();
    const dialog = page.getByRole('dialog');
    const composer = page.getByTestId('input-chat-message');
    const close = page.getByTestId('button-close-chat');
    await expect(dialog).toBeVisible();
    await expect(close).toHaveAttribute('aria-label', locale.closeLabel);
    await expect(composer).toHaveAttribute('placeholder', locale.placeholder);
    await expect(composer).toBeFocused();

    const setVisualViewport = async (height: number, offsetTop: number, event: 'resize' | 'scroll') => {
      await page.evaluate(({ height: nextHeight, offsetTop: nextOffsetTop, event: nextEvent }) => {
        const setter = (window as Window & {
          setTestVisualViewport?: (nextHeight: number, nextOffsetTop: number, nextEvent: string) => void;
        }).setTestVisualViewport;
        if (!setter) throw new Error('VisualViewport test harness was not installed');
        setter(nextHeight, nextOffsetTop, nextEvent);
      }, { height, offsetTop, event });
    };

    await setVisualViewport(360, 0, 'resize');
    await expect.poll(() => dialog.evaluate(el => getComputedStyle(el.parentElement!).getPropertyValue('--chat-vvh').trim())).toBe('360px');
    await expect.poll(() => dialog.evaluate(el => getComputedStyle(el.parentElement!).getPropertyValue('--chat-kb').trim())).toBe('380px');

    // A visual viewport scroll can change its top offset while the layout
    // viewport remains fixed, as happens in some on-screen keyboard states.
    await setVisualViewport(340, 18, 'scroll');
    await expect.poll(() => dialog.evaluate(el => getComputedStyle(el.parentElement!).getPropertyValue('--chat-vvh').trim())).toBe('340px');
    await expect.poll(() => dialog.evaluate(el => getComputedStyle(el.parentElement!).getPropertyValue('--chat-kb').trim())).toBe('382px');

    const visibleBounds = { top: 18, bottom: 358 };
    for (const control of [close, composer]) {
      const box = await control.boundingBox();
      expect(box, `${locale.name} ${await control.getAttribute('data-testid')} should have a visible box`).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(visibleBounds.top);
      expect(box!.y + box!.height).toBeLessThanOrEqual(visibleBounds.bottom);
    }
    await expect(close).toBeEnabled();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const star = dialog.locator('.chat-ui__avatar-star').first();
    await star.evaluate(el => el.parentElement?.classList.add('is-glowing'));
    await expect.poll(() => star.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await expect.poll(() => star.evaluate(el => getComputedStyle(el).opacity)).toBe('0.8');

    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('button-open-chat')).toBeFocused();
  });

  test(`${locale.name} long replies remain readable and scrollable at 150% text size`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await page.addInitScript(() => {
      localStorage.setItem('funademy-chat-consent', 'yes');
    });

    const longReply = [
      ...Array.from({ length: 14 }, () => locale.direction === 'rtl'
        ? 'هذه إجابة طويلة للتأكد من التفاف النص العربي ووضوح التفاصيل عند تكبير الخط.'
        : 'This is a long reply to check readable wrapping and clear details at a larger text size.'),
      '/book',
      `https://example.invalid/${'long-path-segment-'.repeat(12)}`,
    ].join('\n');
    const sourceTitle = locale.direction === 'rtl'
      ? 'مرجع طويل يشرح البرامج والمواعيد وكيفية اختيار التجربة المناسبة للعائلة'
      : 'A long reference explaining programs, schedules, and how families can choose the right trial';

    await page.route('**/svc/chat/conversations/*/messages', route => route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        `data: ${JSON.stringify({ type: 'delta', content: longReply })}`,
        '',
        `data: ${JSON.stringify({
          type: 'done',
          messageId: 'large-text-reply',
          sources: [{ title: sourceTitle, url: `https://example.invalid/${'source-reference-'.repeat(8)}` }],
          preparedAction: { id: 'large-text-action', kind: 'book_trial', payload: {} },
        })}`,
        '',
        '',
      ].join('\n'),
    }));
    await page.route('**/svc/chat/conversations', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ conversation: { id: 'large-text-conversation' } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [], hasFamilyAccount: false }),
      });
    });

    await page.goto(locale.path);
    await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
    await page.getByTestId('button-open-chat').click();

    const dialog = page.getByRole('dialog');
    const messages = page.locator('.chat-ui__messages');
    const close = page.getByTestId('button-close-chat');
    const composer = page.getByTestId('input-chat-message');
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.locator('.chat-ui__message > p').first().evaluate(el => getComputedStyle(el).fontSize)).toBe('21px');

    for (const suggestion of [
      page.getByTestId('button-chat-shortcut-age'),
      page.getByTestId('button-chat-shortcut-trial'),
      page.getByTestId('button-chat-shortcut-gears'),
      page.getByTestId('link-chat-book'),
      page.getByTestId('link-chat-consult'),
      page.getByTestId('link-chat-enroll'),
      page.getByTestId('link-chat-account'),
    ]) {
      await suggestion.scrollIntoViewIfNeeded();
      await expect(suggestion).toBeVisible();
      const suggestionBox = await suggestion.boundingBox();
      const messageBox = await messages.boundingBox();
      expect(suggestionBox).not.toBeNull();
      expect(messageBox).not.toBeNull();
      expect(suggestionBox!.width).toBeLessThanOrEqual(messageBox!.width);
    }

    await page.getByTestId('button-chat-shortcut-age').click();
    const reply = page.getByTestId('message-chat-large-text-reply');
    await expect(reply).toContainText('/book');
    await expect(reply.locator('.chat-ui__sources a')).toContainText(sourceTitle);
    await expect(reply.getByTestId('link-chat-inline-large-text-reply-0')).toHaveAttribute('href', '/book');
    const action = page.locator('.chat-ui__action-card').filter({ has: page.getByTestId('button-confirm-action-large-text-action') });
    await expect(action).toBeVisible();

    const scrollMetrics = await messages.evaluate(el => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(scrollMetrics.overflowY).toBe('auto');
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

    for (const content of [
      reply,
      reply.locator('.chat-ui__sources a'),
      page.getByTestId('link-chat-inline-large-text-reply-0'),
      action,
      page.getByTestId('button-confirm-action-large-text-action'),
    ]) {
      await content.scrollIntoViewIfNeeded();
      await expect(content).toBeVisible();
    }
    await messages.evaluate(el => { el.scrollTop = el.scrollHeight; });

    const panelBox = await dialog.boundingBox();
    expect(panelBox).not.toBeNull();
    for (const control of [close, composer]) {
      const box = await control.boundingBox();
      expect(box, 'chat controls should keep a visible box while messages scroll').not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(panelBox!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
    }
  });
}
