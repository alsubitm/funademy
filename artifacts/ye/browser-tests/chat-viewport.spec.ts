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

  test(`${locale.name} conversation history stays readable and reachable at 150% text size`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await page.addInitScript(() => {
      localStorage.setItem('funademy-chat-consent', 'yes');
    });

    const longTitle = locale.direction === 'rtl'
      ? 'اختيار تجربة هندسية عملية تناسب عمر الطفل واهتماماته ومواعيد العائلة قبل التسجيل في البرنامج'
      : 'Choosing a hands-on engineering trial that fits our child’s age, interests, and family schedule before enrollment';
    const sessions = [
      { id: 'history-long-title', title: longTitle },
      { id: 'history-builds', title: locale.direction === 'rtl' ? 'أفكار بناء الروبوتات' : 'Robot-building ideas' },
      { id: 'history-schedules', title: locale.direction === 'rtl' ? 'مواعيد التجارب القادمة' : 'Upcoming trial schedules' },
      { id: 'history-projects', title: locale.direction === 'rtl' ? 'مشاريع هندسية للأطفال' : 'Engineering projects for children' },
    ];

    await page.route('**/svc/chat/conversations', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: sessions, hasFamilyAccount: false }),
    }));
    await page.route('**/svc/chat/conversations/history-long-title', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          { id: 'history-user-message', role: 'user', content: locale.direction === 'rtl' ? 'أرغب في معرفة المزيد عن التجربة.' : 'I would like to learn more about the trial.' },
          { id: 'history-assistant-message', role: 'assistant', content: locale.direction === 'rtl' ? 'يمكننا اختيار تجربة تناسب اهتمامات طفلك.' : 'We can find a trial that matches your child’s interests.' },
        ],
      }),
    }));

    await page.goto(locale.path);
    await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
    await page.getByTestId('button-open-chat').click();

    const dialog = page.getByRole('dialog');
    const history = page.locator('.chat-ui__history');
    const longTitleButton = page.getByTestId('button-chat-session-history-long-title');
    const messages = page.locator('.chat-ui__messages');
    const composer = page.getByTestId('input-chat-message');
    const close = page.getByTestId('button-close-chat');

    await expect(dialog).toBeVisible();
    await expect(longTitleButton).toHaveText(longTitle);
    await expect(longTitleButton).toHaveCSS('white-space', 'normal');
    await expect(longTitleButton).toHaveCSS('text-overflow', 'clip');
    const titleMetrics = await longTitleButton.evaluate(el => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }));
    expect(titleMetrics.scrollWidth).toBeLessThanOrEqual(titleMetrics.clientWidth + 1);
    expect(titleMetrics.scrollHeight).toBeLessThanOrEqual(titleMetrics.clientHeight + 1);
    expect(titleMetrics.clientHeight).toBeGreaterThan(44);

    await longTitleButton.click();
    await expect(page.getByTestId('message-chat-history-assistant-message')).toContainText(
      locale.direction === 'rtl' ? 'يمكننا اختيار تجربة' : 'We can find a trial',
    );
    await expect(page.getByTestId('button-new-chat')).toBeVisible();
    await expect(page.getByTestId('button-delete-chat')).toBeVisible();

    const lastSession = page.getByTestId('button-chat-session-history-projects');
    await lastSession.scrollIntoViewIfNeeded();
    await expect(lastSession).toBeVisible();
    const historyBox = await history.boundingBox();
    const lastSessionBox = await lastSession.boundingBox();
    expect(historyBox).not.toBeNull();
    expect(lastSessionBox).not.toBeNull();
    expect(lastSessionBox!.x).toBeGreaterThanOrEqual(historyBox!.x);
    expect(lastSessionBox!.x + lastSessionBox!.width).toBeLessThanOrEqual(historyBox!.x + historyBox!.width);

    const deleteButton = page.getByTestId('button-delete-chat');
    await deleteButton.scrollIntoViewIfNeeded();
    await expect(deleteButton).toBeVisible();
    const deleteBox = await deleteButton.boundingBox();
    const scrolledHistoryBox = await history.boundingBox();
    expect(deleteBox).not.toBeNull();
    expect(scrolledHistoryBox).not.toBeNull();
    expect(deleteBox!.x).toBeGreaterThanOrEqual(scrolledHistoryBox!.x);
    expect(deleteBox!.x + deleteBox!.width).toBeLessThanOrEqual(scrolledHistoryBox!.x + scrolledHistoryBox!.width);

    const messageBox = await messages.boundingBox();
    const composerBox = await composer.boundingBox();
    const closeBox = await close.boundingBox();
    const panelBox = await dialog.boundingBox();
    for (const box of [messageBox, composerBox, closeBox, panelBox]) expect(box).not.toBeNull();
    expect(messageBox!.width).toBeGreaterThan(250);
    expect(messageBox!.height).toBeGreaterThan(80);
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
    expect(closeBox!.y).toBeGreaterThanOrEqual(panelBox!.y);
    expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
  });

  test(`${locale.name} offline notice wraps at 150% without hiding chat controls`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.addInitScript(() => {
      localStorage.setItem('funademy-chat-consent', 'yes');
    });
    await page.route('**/svc/chat/conversations', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [], hasFamilyAccount: false }),
    }));
    await page.goto(locale.path);
    await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
    await page.getByTestId('button-open-chat').click();

    const dialog = page.getByRole('dialog');
    const offlineNotice = page.getByTestId('status-chat-offline');
    const composer = page.getByTestId('input-chat-message');
    const close = page.getByTestId('button-close-chat');
    await page.context().setOffline(true);
    await expect(offlineNotice).toContainText(locale.direction === 'rtl' ? 'غير متصل' : 'offline');
    await expect.poll(() => offlineNotice.evaluate(el => el.clientHeight > Number.parseFloat(getComputedStyle(el).lineHeight))).toBe(true);
    await expect.poll(() => offlineNotice.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(composer).toBeVisible();
    await expect(close).toBeVisible();
    await expect(close).toBeEnabled();

    const panelBox = await dialog.boundingBox();
    expect(panelBox).not.toBeNull();
    for (const control of [close, composer]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
      expect(box!.y).toBeGreaterThanOrEqual(panelBox!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
    }

    await page.context().setOffline(false);
    await expect(offlineNotice).toHaveCount(0);
    await expect(composer).toBeEnabled();
  });

  test(`${locale.name} retry notice wraps at 150% without hiding chat controls`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.addInitScript(() => {
      localStorage.setItem('funademy-chat-consent', 'yes');
    });

    let messageAttempts = 0;
    await page.route('**/svc/chat/conversations', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(route.request().method() === 'POST'
        ? { conversation: { id: 'large-text-retry-conversation' } }
        : { conversations: [], hasFamilyAccount: false }),
    }));
    await page.route('**/svc/chat/conversations/*/messages', route => {
      messageAttempts += 1;
      if (messageAttempts === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'temporary_unavailable' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          `data: ${JSON.stringify({ type: 'delta', content: locale.direction === 'rtl' ? 'عاد الاتصال، وتم إرسال رسالتك بنجاح.' : 'Your connection recovered and your message was sent successfully.' })}`,
          '',
          `data: ${JSON.stringify({ type: 'done', messageId: 'large-text-retry-reply' })}`,
          '',
          '',
        ].join('\n'),
      });
    });

    await page.goto(locale.path);
    await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
    await page.getByTestId('button-open-chat').click();
    const dialog = page.getByRole('dialog');
    const composer = page.getByTestId('input-chat-message');
    const close = page.getByTestId('button-close-chat');
    await composer.fill(locale.direction === 'rtl' ? 'أحتاج مساعدة' : 'I need help');
    await page.getByTestId('button-send-chat').click();

    const alert = page.locator('.chat-ui__error[role="alert"]');
    const retry = page.getByTestId('button-chat-retry');
    await expect(alert).toBeVisible();
    await expect(retry).toBeVisible();
    await expect.poll(() => alert.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect.poll(() => alert.locator('span').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(composer).toBeVisible();
    await expect(composer).toBeEnabled();
    await expect(close).toBeVisible();
    await expect(close).toBeEnabled();

    const alertBox = await alert.boundingBox();
    const retryBox = await retry.boundingBox();
    const panelBox = await dialog.boundingBox();
    expect(alertBox).not.toBeNull();
    expect(retryBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(retryBox!.x).toBeGreaterThanOrEqual(alertBox!.x);
    expect(retryBox!.x + retryBox!.width).toBeLessThanOrEqual(alertBox!.x + alertBox!.width);
    for (const control of [close, composer]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
      expect(box!.y).toBeGreaterThanOrEqual(panelBox!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
    }

    await retry.click();
    await expect(page.getByTestId('message-chat-large-text-retry-reply')).toContainText(
      locale.direction === 'rtl' ? 'تم إرسال رسالتك بنجاح' : 'sent successfully',
    );
    await expect(alert).toHaveCount(0);
    expect(messageAttempts).toBe(2);
  });
}
