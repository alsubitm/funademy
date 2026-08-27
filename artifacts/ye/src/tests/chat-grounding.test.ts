import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  answerWithOpenAI,
  deterministicGroundedAnswer,
  OPENAI_CHAT_MODEL,
  validateGroundedAnswer,
} from '@/lib/chat-openai';
import type { KnowledgeSource } from '@/lib/chat-knowledge';

const sources: KnowledgeSource[] = [{
  id: 'faq:1',
  type: 'faq',
  title: 'سؤال / Question',
  titleAr: 'سؤال',
  titleEn: 'Question',
  url: '/#faq',
  text: 'Classes are on Sunday.',
}];

const originalApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const originalBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  else process.env.AI_INTEGRATIONS_OPENAI_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  else process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = originalBaseUrl;
});

describe('chat provider grounding authority', () => {
  it('rejects missing, unknown, and partially cited factual lines', () => {
    expect(validateGroundedAnswer('Classes are Sunday.', sources)).toBe(false);
    expect(validateGroundedAnswer('Classes are Sunday. [faq:999]', sources)).toBe(false);
    expect(validateGroundedAnswer('Classes are Sunday. [faq:1] [unknown]', sources)).toBe(false);
    expect(validateGroundedAnswer('Classes are Sunday. [faq:1]\nThey cost SAR 1.', sources)).toBe(false);
    expect(validateGroundedAnswer('Classes are Sunday. [faq:1]', sources)).toBe(true);
    expect(validateGroundedAnswer('Anything [faq:1]', [])).toBe(false);
  });

  it('builds only explicitly cited deterministic source lines', () => {
    expect(deterministicGroundedAnswer(sources, 'en')).toBe('• Classes are on Sunday. [faq:1]');
    expect(deterministicGroundedAnswer([], 'ar')).toBeNull();
  });

  it('sends a valid request through the real OpenAI SDK with the managed model', async () => {
    let requestBody: Record<string, unknown> | null = null;
    const server = createServer((request, response) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        requestBody = JSON.parse(body) as Record<string, unknown>;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1,
          model: OPENAI_CHAT_MODEL,
          choices: [{
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'Classes are Sunday. [faq:1]' },
          }],
        }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test_server_unavailable');
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY = 'replit-managed-test';
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;

      await expect(answerWithOpenAI('When are classes?', [], sources))
        .resolves.toBe('Classes are Sunday. [faq:1]');
      expect(requestBody).toMatchObject({ model: OPENAI_CHAT_MODEL });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});