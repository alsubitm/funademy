import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { testDbUrl } from '../src/tests/test-db';

const db = new PrismaClient({ datasourceUrl: testDbUrl() });
const createdConversations = new Set<string>();
const createdRateKeys = new Set<string>();
test.beforeEach(async ({ page }) => {
  // Real handlers enforce durable IP quotas. Isolate each browser scenario
  // so adding cases or rerunning this file cannot exhaust another test's limit.
  const ip = `fd00:${randomBytes(14).toString('hex').match(/.{4}/g)!.join(':')}`;
  createdRateKeys.add(`chat:create:${ip}`);
  createdRateKeys.add(`chat:send:${ip}`);
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': ip });
});
test.afterEach(async () => {
  const ids = [...createdConversations];
  await db.chatAudit.deleteMany({ where: { conversationId: { in: ids } } });
  await db.chatConversation.deleteMany({ where: { id: { in: ids } } });
  createdConversations.clear();
  await db.rateLimitHit.deleteMany({ where: { key: { in: [...createdRateKeys] } } });
  await db.rateLimitWindow.deleteMany({ where: { key: { in: [...createdRateKeys] } } });
  createdRateKeys.clear();
});
test.afterAll(async () => { await db.$disconnect(); });

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
  for (const chunking of ['single-byte', 'uneven'] as const) {
    test(`${locale.name} preserves a reply split across ${chunking} network chunks`, async ({ page }) => {
      const prompt = locale.direction === 'rtl' ? 'ساعدني أختار برنامج لطفلي' : 'Help me choose a program for my child';
      let complete = '';
      let replyId = '';
      let submitted = 0;
      await page.setViewportSize({ width: 390, height: 740 });
      await page.addInitScript(({ chunking }) => {
        localStorage.setItem('funademy-chat-consent', 'yes');
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args: Parameters<typeof fetch>) => {
          const response = await originalFetch(...args);
          if (!String(args[0]).match(/\/svc\/chat\/conversations\/[^/]+\/messages$/)) return response;
          const body = await response.text();
          const encoder = new TextEncoder();
          const bytes = encoder.encode(body);
          const terminalStart = encoder.encode(body.slice(0, body.indexOf('data: {"type":"done"'))).length;
          const firstMultibyte = bytes.findIndex(byte => byte >= 0xc0);
          // Force cuts inside a UTF-8 character, the terminal event's JSON,
          // and its final \n\n delimiter, regardless of the uneven pattern.
          const forcedCuts = [
            ...(firstMultibyte >= 0 ? [firstMultibyte + 1] : []),
            terminalStart + 1, terminalStart + 12, bytes.length - 1,
          ].sort((a, b) => a - b);
          const sizes = chunking === 'single-byte' ? [1] : [1, 7, 2, 13, 3, 5];
          let offset = 0;
          let delivered = 0;
          return new Response(new ReadableStream<Uint8Array>({
            pull(controller) {
              let end = Math.min(offset + sizes[delivered % sizes.length], bytes.length);
              const cut = forcedCuts.find(boundary => boundary > offset && boundary < end);
              if (cut !== undefined) end = cut;
              if (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
                document.documentElement.dataset.chatSplitUtf8 = 'yes';
              }
              if (end > terminalStart && end < bytes.length - 2) {
                document.documentElement.dataset.chatSplitTerminal = 'yes';
              }
              controller.enqueue(bytes.slice(offset, end));
              offset = end;
              delivered += 1;
              document.documentElement.dataset.chatByteChunks = String(delivered);
              if (offset === bytes.length) {
                document.documentElement.dataset.chatByteStreamComplete = 'yes';
                controller.close();
              }
            },
          }, { highWaterMark: 0 }), { status: response.status, headers: response.headers });
        };
      }, { chunking });
      await page.route('**/svc/chat/conversations/*/messages', async route => {
        submitted += 1;
        createdConversations.add(new URL(route.request().url()).pathname.split('/').at(-2)!);
        // Preserve the isolated server's real localized answer and done event;
        // only browser-side transport boundaries change.
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        const body = await response.text();
        const events = body.split('\n\n').filter(event => event.startsWith('data:'))
          .map(event => JSON.parse(event.slice(5)));
        complete = events.filter(event => event.type === 'delta').map(event => event.content).join('');
        replyId = events.find(event => event.type === 'done').messageId;
        expect(complete.length).toBeGreaterThan(0);
        expect(complete).not.toContain('\uFFFD');
        if (locale.direction === 'rtl') expect(complete).toMatch(/[\u0600-\u06ff]/);
        expect(body).toContain('data: {"type":"done"');
        expect(body.endsWith('\n\n')).toBe(true);
        await route.fulfill({ response, body });
      });
      await page.goto(locale.path);
      await page.getByTestId('button-open-chat').click();
      const composer = page.getByTestId('input-chat-message');
      await composer.fill(prompt);
      await page.getByTestId('button-send-chat').click();

      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-chat-byte-stream-complete', 'yes');
      // Resolve the id only after the request handler has captured it.
      await expect(composer).toBeEnabled();
      await expect(page.getByTestId(`message-chat-${replyId}`).locator(':scope > p')).toHaveText(complete);
      await expect(page.getByText(complete, { exact: true })).toHaveCount(1);
      await expect(page.getByText(prompt, { exact: true })).toHaveCount(1);
      await expect(page.locator('.chat-ui__message')).toHaveCount(2);
      await expect(page.locator('.chat-ui__messages')).not.toContainText('\uFFFD');
      await expect(page.locator('.chat-ui__error[role="alert"]')).toHaveCount(0);
      await expect(page.getByTestId('button-chat-retry')).toHaveCount(0);
      await expect(html).toHaveAttribute('data-chat-split-terminal', 'yes');
      if (locale.direction === 'rtl') await expect(html).toHaveAttribute('data-chat-split-utf8', 'yes');
      expect(Number(await html.getAttribute('data-chat-byte-chunks'))).toBeGreaterThan(10);
      expect(submitted).toBe(1);
    });
  }

  test(`${locale.name} keeps a slow reply active while chunks keep arriving`, async ({ page }) => {
    const prompt = locale.direction === 'rtl' ? 'ساعدني أختار برنامج لطفلي' : 'Help me choose a program for my child';
    let complete = '';
    let replyId = '';
    let submitted = 0;
    await page.setViewportSize({ width: 390, height: 740 });
    await page.addInitScript(() => {
      localStorage.setItem('funademy-chat-consent', 'yes');
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);
        if (!String(args[0]).match(/\/svc\/chat\/conversations\/[^/]+\/messages$/)) return response;
        const events = (await response.text()).split('\n\n').filter(Boolean);
        args[1]?.signal?.addEventListener('abort', () => {
          document.documentElement.dataset.chatReplyAborted = 'yes';
        }, { once: true });
        let delivered = 0;
        return new Response(new ReadableStream<Uint8Array>({
          async pull(controller) {
            // Browser-clock time, not wall-clock sleeps: each delta and the
            // final done event arrive 20 seconds after the preceding chunk.
            if (delivered > 0) await new Promise(resolve => setTimeout(resolve, 20_000));
            controller.enqueue(new TextEncoder().encode(`${events[delivered]}\n\n`));
            delivered += 1;
            document.documentElement.dataset.chatChunksDelivered = String(delivered);
            if (delivered === events.length) controller.close();
          },
        }, { highWaterMark: 0 }), { status: response.status, headers: response.headers });
      };
    });
    await page.route('**/svc/chat/conversations/*/messages', async route => {
      submitted += 1;
      const conversationId = new URL(route.request().url()).pathname.split('/').at(-2)!;
      createdConversations.add(conversationId);
      // Keep the isolated server's real saved answer and completion metadata;
      // change only how quickly the browser receives that response.
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      const events = (await response.text()).split('\n\n')
        .filter(event => event.startsWith('data:'))
        .map(event => JSON.parse(event.slice(5)));
      complete = events.filter(event => event.type === 'delta').map(event => event.content).join('');
      const done = events.find(event => event.type === 'done');
      replyId = done.messageId;
      expect(complete.length).toBeGreaterThanOrEqual(4);
      const size = Math.ceil(complete.length / 4);
      const deltas = Array.from({ length: 4 }, (_, index) => ({
        type: 'delta', content: complete.slice(index * size, (index + 1) * size),
      }));
      await route.fulfill({
        response,
        body: [...deltas, done].map(event => `data: ${JSON.stringify(event)}\n\n`).join(''),
      });
    });
    await page.goto(locale.path);
    await page.getByTestId('button-open-chat').click();
    const start = new Date('2030-01-01T00:00:00Z');
    await page.clock.install({ time: start });
    await page.clock.pauseAt(new Date(start.getTime() + 1_000));
    const composer = page.getByTestId('input-chat-message');
    await composer.fill(prompt);
    await page.getByTestId('button-send-chat').click();
    const html = page.locator('html');
    const alert = page.locator('.chat-ui__error[role="alert"]');
    const retry = page.getByTestId('button-chat-retry');
    await expect(html).toHaveAttribute('data-chat-chunks-delivered', '1');
    await expect(composer).toBeDisabled();

    for (let delivered = 2; delivered <= 5; delivered += 1) {
      await page.clock.runFor(20_000);
      await expect(html).toHaveAttribute('data-chat-chunks-delivered', String(delivered));
      await expect(html).not.toHaveAttribute('data-chat-reply-aborted', 'yes');
      await expect(alert).toHaveCount(0);
      await expect(retry).toHaveCount(0);
      if (delivered < 5) await expect(composer).toBeDisabled();
    }
    // At 80 seconds, every previous chunk's 30-second deadline has passed.
    // Continued success therefore requires resetting inactivity on each read.
    const answer = page.getByTestId(`message-chat-${replyId}`).locator(':scope > p');
    await expect(answer).toHaveText(complete);
    await expect(composer).toBeEnabled();
    await page.clock.runFor(31_000);
    await expect(answer).toHaveText(complete);
    await expect(page.getByText(complete, { exact: true })).toHaveCount(1);
    await expect(page.getByText(prompt, { exact: true })).toHaveCount(1);
    await expect(page.locator('.chat-ui__message')).toHaveCount(2);
    await expect(html).not.toHaveAttribute('data-chat-reply-aborted', 'yes');
    await expect(alert).toHaveCount(0);
    await expect(retry).toHaveCount(0);
    expect(submitted).toBe(1);
  });

  for (const destination of ['history', 'new-chat'] as const) {
    for (const lateOutcome of ['reply', 'error'] as const) {
      test(`${locale.name} isolates a late ${lateOutcome} after switching to ${destination}`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 740 });
        await page.addInitScript(() => {
          localStorage.setItem('funademy-chat-consent', 'yes');
          const originalFetch = window.fetch.bind(window);
          const encoder = new TextEncoder();
          const held: {
            controller: ReadableStreamDefaultController<Uint8Array>;
            aborted: boolean;
            cancelled: boolean;
            abortCallbacks: (() => void)[];
          }[] = [];
          const submitted: { conversationId: string; content: string }[] = [];
          Object.assign(window, {
            chatSwitchHarness: {
              submitted,
              held,
              async release(index: number, outcome: 'reply' | 'error') {
                const stream = held[index];
                if (outcome === 'error') {
                  stream.controller.error(new TypeError('Late failure from the old conversation'));
                } else {
                  stream.controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: 'delta', content: index === 0 ? 'OLD REPLY MUST NOT APPEAR' : 'Destination reply' })}\n\n` +
                    `data: ${JSON.stringify({
                      type: 'done', messageId: `switch-reply-${index}`,
                      ...(index === 0 ? {
                        celebrate: true,
                        preparedAction: { id: 'old-action', kind: 'book_trial', payload: {} },
                      } : {}),
                    })}\n\n`,
                  ));
                  stream.controller.close();
                }
                // Let the old send's catch/finally run while the new send is
                // pending, then deliver its deferred abort notifications too.
                await new Promise(resolve => setTimeout(resolve, 0));
                stream.abortCallbacks.forEach(callback => callback());
                await new Promise(resolve => setTimeout(resolve, 0));
              },
            },
          });
          window.fetch = async (...args: Parameters<typeof fetch>) => {
            const match = String(args[0]).match(/\/svc\/chat\/conversations\/([^/]+)\/messages$/);
            if (!match) return originalFetch(...args);
            const index = held.length;
            const signal = args[1]!.signal!;
            const stream = {
              controller: undefined as unknown as ReadableStreamDefaultController<Uint8Array>,
              aborted: false,
              cancelled: false,
              abortCallbacks: [] as (() => void)[],
            };
            held.push(stream);
            submitted.push({
              conversationId: match[1],
              content: JSON.parse(String(args[1]!.body)).content,
            });
            const addEventListener = signal.addEventListener.bind(signal);
            addEventListener('abort', () => { stream.aborted = signal.aborted; }, { once: true });
            if (index === 0) {
              // Adversarial transport: abort really happens, but its consumers
              // settle late. Without this delay the old finally always runs
              // before the next click, leaving the request-ownership guard
              // untested. No application internals are exposed or replaced.
              signal.addEventListener = (type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
                if (!callback) return;
                if (type !== 'abort') return addEventListener(type, callback, options);
                addEventListener(type, event => {
                  stream.abortCallbacks.push(() => {
                    if (typeof callback === 'function') callback.call(signal, event);
                    else callback.handleEvent(event);
                  });
                }, options);
              };
            }
            const body = new ReadableStream<Uint8Array>({
              start(controller) {
                stream.controller = controller;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: '' })}\n\n`));
              },
            }, { highWaterMark: 0 });
            const getReader = body.getReader.bind(body);
            Object.defineProperty(body, 'getReader', { value: () => {
              const reader = getReader();
              const cancel = reader.cancel.bind(reader);
              reader.cancel = reason => {
                // Record the cleanup call even after EOF or a stream error,
                // when the underlying stream's cancel hook no longer runs.
                stream.cancelled = true;
                return cancel(reason);
              };
              return reader;
            } });
            return new Response(body, {
              status: 200, headers: { 'Content-Type': 'text/event-stream' },
            });
          };
        });
        await page.route('**/svc/chat/conversations', route => route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify(route.request().method() === 'POST'
            ? { conversation: { id: 'fresh-conversation' } }
            : { conversations: [
              { id: 'source-conversation', title: 'Source conversation' },
              { id: 'destination-conversation', title: 'Destination conversation' },
            ], hasFamilyAccount: false }),
        }));
        await page.route('**/svc/chat/conversations/*', route => {
          const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
          return route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({ messages: [{
              id: `${id}-saved`, role: 'assistant',
              content: id === 'source-conversation' ? 'Saved source answer' : 'Saved destination answer',
            }] }),
          });
        });
        const harness = () => page.evaluate(() => {
          const state = (window as unknown as { chatSwitchHarness: {
            submitted: { conversationId: string; content: string }[];
            held: { aborted: boolean; cancelled: boolean }[];
          } }).chatSwitchHarness;
          return { submitted: state.submitted, held: state.held.map(({ aborted, cancelled }) => ({ aborted, cancelled })) };
        });
        const release = (index: number, outcome: 'reply' | 'error') => page.evaluate(
          ({ index, outcome }) => (window as unknown as { chatSwitchHarness: {
            release: (index: number, outcome: 'reply' | 'error') => Promise<void>;
          } }).chatSwitchHarness.release(index, outcome),
          { index, outcome },
        );

        await page.goto(locale.path);
        await page.getByTestId('button-open-chat').click();
        await page.getByTestId('button-chat-session-source-conversation').click();
        await expect(page.getByTestId('message-chat-source-conversation-saved')).toContainText('Saved source answer');
        const composer = page.getByTestId('input-chat-message');
        const send = page.getByTestId('button-send-chat');
        const messages = page.locator('.chat-ui__messages');
        const oldPrompt = 'Question in the old conversation';
        const newPrompt = 'Question in the destination conversation';
        await composer.fill(oldPrompt);
        await send.click();
        await expect.poll(async () => (await harness()).held.length).toBe(1);
        await expect(composer).toBeDisabled();
        await expect(messages).toHaveAttribute('aria-busy', 'true');

        if (destination === 'history') {
          await page.getByTestId('button-chat-session-destination-conversation').click();
          await expect(page.getByTestId('message-chat-destination-conversation-saved')).toContainText('Saved destination answer');
        } else {
          await page.getByTestId('button-new-chat').click();
          await expect(page.locator('[data-testid^="message-chat-"]')).toHaveCount(0);
          await expect(page.getByTestId('text-chat-greeting')).toBeVisible();
        }
        await expect.poll(async () => (await harness()).held[0].aborted).toBe(true);
        await expect(composer).toBeEnabled();
        await expect(messages).toHaveAttribute('aria-busy', 'false');
        await expect(page.getByText(oldPrompt, { exact: true })).toHaveCount(0);
        await expect(page.getByText('Saved source answer', { exact: true })).toHaveCount(0);
        await composer.fill(newPrompt);
        await send.click();
        await expect.poll(async () => (await harness()).held.length).toBe(2);
        await expect(composer).toBeDisabled();

        await release(0, lateOutcome);
        await expect.poll(async () => (await harness()).held[0].cancelled).toBe(true);
        // The cancelled send must not append messages/actions, show a retry,
        // or clear the destination send's busy state from its finally block.
        await expect(page.getByText('OLD REPLY MUST NOT APPEAR', { exact: true })).toHaveCount(0);
        await expect(page.getByTestId('message-chat-switch-reply-0')).toHaveCount(0);
        await expect(page.getByTestId('button-confirm-action-old-action')).toHaveCount(0);
        await expect(page.locator('.chat-ui__error[role="alert"]')).toHaveCount(0);
        await expect(page.getByTestId('button-chat-retry')).toHaveCount(0);
        await expect(composer).toBeDisabled();
        await expect(send).toBeDisabled();
        await expect(messages).toHaveAttribute('aria-busy', 'true');
        await expect(page.locator('.chat-ui__typing')).toBeVisible();
        expect((await harness()).held[1].aborted).toBe(false);
        expect((await harness()).submitted).toEqual([
          { conversationId: 'source-conversation', content: oldPrompt },
          { conversationId: destination === 'history' ? 'destination-conversation' : 'fresh-conversation', content: newPrompt },
        ]);

        await release(1, 'reply');
        await expect(page.getByTestId('message-chat-switch-reply-1')).toContainText('Destination reply');
        await expect(composer).toBeEnabled();
        await expect(messages).toHaveAttribute('aria-busy', 'false');
        await expect(page.locator('.chat-ui__typing')).toHaveCount(0);
        await expect(page.locator('.chat-ui__message > p').filter({ hasText: newPrompt })).toHaveCount(1);
        await expect(page.locator('.chat-ui__message')).toHaveCount(destination === 'history' ? 3 : 2);
        await expect(page.locator('.chat-ui__error[role="alert"]')).toHaveCount(0);
        await expect(page.getByTestId('button-chat-retry')).toHaveCount(0);
      });
    }
  }

  for (const interruption of ['truncated', 'read-error', 'stalled', 'stalled-after-chunks', 'cancelled'] as const) {
    test(`${locale.name} retries a ${interruption} reply stream without duplicating the prompt`, async ({ page }) => {
      const prompt = locale.direction === 'rtl' ? 'ساعدني أختار برنامج لطفلي' : 'Help me choose a program for my child';
      let partial = '';
      let complete = '';
      let replyId = '';
      let conversationId = '';
      const submitted: { content: string; idempotencyKey: string }[] = [];
      await page.setViewportSize({ width: 390, height: 740 });
      await page.addInitScript(({ interruption }) => {
        localStorage.setItem('funademy-chat-consent', 'yes');
        const originalFetch = window.fetch.bind(window);
        let interrupted = false;
        window.fetch = async (...args: Parameters<typeof fetch>) => {
          const response = await originalFetch(...args);
          if (interrupted || !String(args[0]).match(/\/svc\/chat\/conversations\/[^/]+\/messages$/)) return response;
          interrupted = true;
          const delayedEvents = interruption === 'stalled-after-chunks'
            ? (await response.text()).split('\n\n').filter(Boolean) : null;
          const reader = delayedEvents ? null : response.body!.getReader();
          args[1]?.signal?.addEventListener('abort', () => {
            document.documentElement.dataset.chatReplyAborted = 'yes';
          }, { once: true });
          let delivered = false;
          let deliveredChunks = 0;
          return new Response(new ReadableStream<Uint8Array>({
            async pull(controller) {
              if (delayedEvents) {
                if (deliveredChunks === delayedEvents.length) {
                  // Never send EOF or done: only the inactivity deadline can
                  // release the composer after the last healthy delta.
                  await new Promise(() => {});
                  return;
                }
                if (deliveredChunks > 0) await new Promise(resolve => setTimeout(resolve, 20_000));
                controller.enqueue(new TextEncoder().encode(`${delayedEvents[deliveredChunks]}\n\n`));
                deliveredChunks += 1;
                document.documentElement.dataset.chatChunksDelivered = String(deliveredChunks);
                document.documentElement.dataset.chatPartialRead = 'yes';
                return;
              }
              if (delivered && (interruption === 'stalled' || interruption === 'cancelled')) {
                // Leave the connection open forever after the first delta.
                await new Promise(() => {});
                return;
              }
              if (delivered && interruption === 'read-error') {
                await reader!.cancel();
                controller.error(new TypeError('Connection interrupted after partial reply'));
                return;
              }
              const chunk = await reader!.read();
              if (chunk.done) {
                controller.close();
              } else {
                delivered = true;
                document.documentElement.dataset.chatPartialRead = 'yes';
                controller.enqueue(chunk.value);
              }
            },
            cancel() {
              document.documentElement.dataset.chatReaderCancelled = 'yes';
              return reader?.cancel();
            },
          }, { highWaterMark: 0 }), { status: response.status, headers: response.headers });
        };
      }, { interruption });
      await page.route('**/svc/chat/conversations/*/messages', async route => {
        submitted.push(route.request().postDataJSON());
        conversationId = new URL(route.request().url()).pathname.split('/').at(-2)!;
        createdConversations.add(conversationId);
        if (submitted.length !== 1) return route.continue();
        // Commit the real prompt and reply before cutting off delivery. The
        // retry must replay that exact saved answer, not write a second pair.
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        const events = (await response.text()).split('\n\n')
          .filter(event => event.startsWith('data:'))
          .map(event => JSON.parse(event.slice(5)));
        complete = events.find(event => event.type === 'delta').content;
        replyId = events.find(event => event.type === 'done').messageId;
        partial = complete.slice(0, interruption === 'stalled-after-chunks' ? 48 : 12);
        const size = Math.ceil(partial.length / 4);
        const deltas = interruption === 'stalled-after-chunks'
          ? Array.from({ length: 4 }, (_, index) => ({
            type: 'delta', content: partial.slice(index * size, (index + 1) * size),
          }))
          : [{ type: 'delta', content: partial }];
        if (interruption === 'stalled-after-chunks') {
          expect(partial.length).toBeGreaterThanOrEqual(4);
          expect(partial).not.toBe(complete);
        }
        await route.fulfill({
          response,
          body: deltas.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''),
        });
      });
      await page.goto(locale.path);
      await page.getByTestId('button-open-chat').click();
      const start = new Date('2030-01-01T00:00:00Z');
      await page.clock.install({ time: start });
      if (interruption === 'stalled-after-chunks') {
        await page.clock.pauseAt(new Date(start.getTime() + 1_000));
      }
      const composer = page.getByTestId('input-chat-message');
      await composer.fill(prompt);
      await page.getByTestId('button-send-chat').click();

      // The HTTP request succeeded and a delta was consumed before interruption.
      await expect(page.locator('html')).toHaveAttribute('data-chat-partial-read', 'yes');
      const alert = page.locator('.chat-ui__error[role="alert"]');
      if (interruption === 'stalled-after-chunks') {
        const html = page.locator('html');
        const expectActive = async () => {
          await expect(composer).toBeDisabled();
          await expect(alert).toHaveCount(0);
          await expect(page.getByTestId('button-chat-retry')).toHaveCount(0);
          await expect(html).not.toHaveAttribute('data-chat-reply-aborted', 'yes');
          await expect(html).not.toHaveAttribute('data-chat-reader-cancelled', 'yes');
        };
        await expect(html).toHaveAttribute('data-chat-chunks-delivered', '1');
        await expectActive();
        for (let delivered = 2; delivered <= 4; delivered += 1) {
          await page.clock.runFor(20_000);
          await expect(html).toHaveAttribute('data-chat-chunks-delivered', String(delivered));
          await expectActive();
        }
        // At t=89.999s all earlier deadlines have passed, but the latest
        // delta (t=60s) must still have its full 30-second activity window.
        await page.clock.runFor(29_999);
        await expectActive();
        expect(submitted).toHaveLength(1);
        await page.clock.runFor(2);
        await expect(html).toHaveAttribute('data-chat-reply-aborted', 'yes');
        await expect(html).toHaveAttribute('data-chat-reader-cancelled', 'yes');
        await expect(html).toHaveAttribute('data-chat-chunks-delivered', '4');
      }
      if (interruption === 'stalled' || interruption === 'cancelled') {
        await expect(composer).toBeDisabled();
        await expect(alert).toHaveCount(0);
        if (interruption === 'cancelled') {
          await page.getByTestId('button-close-chat').click();
          await page.getByTestId('button-open-chat').click();
          await page.clock.runFor(31_000);
          await expect(page.locator('html')).toHaveAttribute('data-chat-reply-aborted', 'yes');
          await expect(page.locator('html')).toHaveAttribute('data-chat-reader-cancelled', 'yes');
          await expect(alert).toHaveCount(0);
          await expect(page.getByTestId('button-chat-retry')).toHaveCount(0);
          await expect(composer).toBeEnabled();
          expect(submitted).toHaveLength(1);
          return;
        }
        await page.clock.runFor(29_000);
        await expect(composer).toBeDisabled();
        await expect(alert).toHaveCount(0);
        await page.clock.runFor(1_001);
        await expect(page.locator('html')).toHaveAttribute('data-chat-reply-aborted', 'yes');
        await expect(page.locator('html')).toHaveAttribute('data-chat-reader-cancelled', 'yes');
      }
      await expect(alert).toContainText(locale.direction === 'rtl'
        ? 'تعذر إكمال الطلب' : 'We could not complete that request');
      await expect(page.getByTestId('button-chat-retry')).toBeEnabled();
      await expect(composer).toBeEnabled();
      await expect(page.locator('.chat-ui__message > p').filter({ hasText: partial })).toHaveCount(0);
      const promptBubble = page.locator('.chat-ui__message > p').filter({ hasText: prompt });
      await expect(promptBubble).toHaveCount(1);

      await page.getByTestId('button-chat-retry').click();
      await expect(page.getByTestId(`message-chat-${replyId}`).locator(':scope > p')).toHaveText(complete);
      await expect(page.locator('.chat-ui__message > p').filter({ hasText: complete })).toHaveCount(1);
      await expect(promptBubble).toHaveCount(1);
      await expect(page.getByText(partial, { exact: true })).toHaveCount(0);
      await expect(alert).toHaveCount(0);
      await expect(page.getByTestId('button-chat-retry')).toHaveCount(0);
      expect(submitted).toHaveLength(2);
      expect(submitted.map(attempt => attempt.content)).toEqual([prompt, prompt]);
      expect(submitted[1].idempotencyKey).toBe(submitted[0].idempotencyKey);
      const saved = await db.chatMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
      expect(saved.map(message => ({ role: message.role, content: message.content }))).toEqual([
        { role: 'user', content: prompt }, { role: 'assistant', content: complete },
      ]);
      expect(saved[1].id).toBe(replyId);

      // Reopen from server-backed history, rather than trusting local state.
      await page.reload();
      await page.getByTestId('button-open-chat').click();
      await page.getByTestId(`button-chat-session-${conversationId}`).click();
      await expect(page.locator('.chat-ui__message > p').filter({ hasText: prompt })).toHaveCount(1);
      await expect(page.getByTestId(`message-chat-${replyId}`).locator(':scope > p')).toHaveText(complete);
      await expect(page.locator('.chat-ui__message')).toHaveCount(2);
    });
  }

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
