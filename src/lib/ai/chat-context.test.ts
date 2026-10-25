import type { UIMessage } from 'ai';

import { buildChatContextMessages } from './chat-context';
import { EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT } from './chat-response-status';
import { dbMessagesToUIMessages } from './utils';
import { test, expect } from 'vitest';

function createConversation(pattern: string): UIMessage[] {
  const messages: UIMessage[] = [];

  for (let index = 0; index < pattern.length; index += 1) {
    const turn = index + 1;

    messages.push({
      id: `user-${turn}`,
      role: 'user',
      parts: [{ type: 'text', text: `user ${turn}` }],
    });

    if (pattern[index] === 'T') {
      messages.push({
        id: `assistant-${turn}`,
        role: 'assistant',
        parts: [
          { type: 'step-start' },
          {
            type: 'tool-updateSection',
            toolCallId: `assistant-${turn}-tool-0`,
            state: 'output-available',
            input: { sectionId: `section-${turn}` },
            output: { success: true },
          },
          { type: 'step-start' },
          { type: 'text', text: `assistant ${turn}` },
        ],
      });
      continue;
    }

    messages.push({
      id: `assistant-${turn}`,
      role: 'assistant',
      parts: [{ type: 'text', text: `assistant ${turn}` }],
    });
  }

  return messages;
}

test('chat context truncation never starts with an assistant turn', async () => {
  // 11 turns produce 22 UI messages; the 20-message window starts mid-turn.
  const messages = createConversation('NNNNNNNNNNN');

  const modelMessages = await buildChatContextMessages(messages);

  expect(modelMessages[0]?.role).toBe('user');
});

test('chat context truncation does not start with a tool result', async () => {
  const messages = createConversation('TTTNNNNNNNN');

  const modelMessages = await buildChatContextMessages(messages);

  expect(modelMessages[0]?.role).not.toBe('tool');

  for (let index = 0; index < modelMessages.length; index += 1) {
    const message = modelMessages[index];
    if (message?.role !== 'tool' || typeof message.content === 'string') continue;

    const previous = modelMessages[index - 1];
    if (!previous || previous.role !== 'assistant' || typeof previous.content === 'string') {
      expect.fail('tool result should stay paired with the preceding assistant tool call');
    }

    const previousToolCallIds = new Set(
      previous.content
        .filter((part) => part.type === 'tool-call')
        .map((part) => part.toolCallId)
        .filter((toolCallId): toolCallId is string => Boolean(toolCallId))
    );

    for (const part of message.content) {
      if (part.type !== 'tool-result') continue;
      expect(previousToolCallIds.has(part.toolCallId)).toBeTruthy();
    }
  }
});

test('resumed history keeps tool calls and trailing text in separate assistant steps', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'optimize my resume',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I updated it.',
      metadata: {
        orderedParts: [
          { type: 'step-start' },
          {
            type: 'tool',
            toolName: 'updateSection',
            args: { sectionId: 'summary' },
            result: { success: true },
          },
          { type: 'step-start' },
          { type: 'text', text: 'I updated it.' },
        ],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'continue',
      createdAt: Date.now(),
    },
  ]);

  const modelMessages = await buildChatContextMessages(resumedMessages);

  for (let index = 0; index < modelMessages.length; index += 1) {
    const message = modelMessages[index];
    if (message?.role !== 'assistant' || typeof message.content === 'string') continue;

    const types = message.content.map((part) => part.type);
    expect(!(types.includes('tool-call') && types.includes('text'))).toBeTruthy();

    if (!types.includes('tool-call')) continue;

    const nextMessage = modelMessages[index + 1];
    expect(nextMessage?.role).toBe('tool');
  }
});

test('legacy orderedParts history regains missing step boundaries', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'optimize my resume',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I updated it.',
      metadata: {
        orderedParts: [
          {
            type: 'tool',
            toolName: 'updateSection',
            args: { sectionId: 'summary' },
            result: { success: true },
          },
          { type: 'text', text: 'I updated it.' },
        ],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'continue',
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[1];
  expect(assistantMessage?.parts.map((part) => part.type)).toEqual(['step-start', 'tool-updateSection', 'step-start', 'text']);

  const modelMessages = await buildChatContextMessages(resumedMessages);

  expect(modelMessages[1]?.role).toBe('assistant');
  expect(modelMessages[2]?.role).toBe('tool');
  expect(modelMessages[3]?.role).toBe('assistant');
});

test('legacy orderedParts with repeated tool steps stay provider-valid', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'optimize my resume',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I updated it.',
      metadata: {
        orderedParts: [
          {
            type: 'tool',
            toolName: 'updateSection',
            args: { sectionId: 'summary' },
            result: { success: true },
          },
          {
            type: 'tool',
            toolName: 'updateSection',
            args: { sectionId: 'experience' },
            result: { success: true },
          },
          { type: 'text', text: 'I updated it.' },
        ],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'continue',
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[1];
  expect(assistantMessage?.parts.map((part) => part.type)).toEqual(['step-start', 'tool-updateSection', 'step-start', 'tool-updateSection', 'step-start', 'text']);

  const modelMessages = await buildChatContextMessages(resumedMessages);

  expect(modelMessages[1]?.role).toBe('assistant');
  expect(modelMessages[2]?.role).toBe('tool');
  expect(modelMessages[3]?.role).toBe('assistant');
  expect(modelMessages[4]?.role).toBe('tool');
  expect(modelMessages[5]?.role).toBe('assistant');
});

test('legacy toolCalls history uses documented old tool format', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'optimize my resume',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I updated it.',
      metadata: {
        toolCalls: [{ tool: 'updateSection', args: { sectionId: 'summary' }, applied: false }],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'continue',
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[1];
  expect(assistantMessage?.parts.map((part) => part.type)).toEqual(['step-start', 'tool-updateSection', 'step-start', 'text']);
  expect((assistantMessage?.parts[1] as { output?: unknown }).output).toEqual({ applied: false });

  const modelMessages = await buildChatContextMessages(resumedMessages);

  expect(modelMessages[1]?.role).toBe('assistant');
  expect(modelMessages[2]?.role).toBe('tool');
  expect(modelMessages[3]?.role).toBe('assistant');
});

test('resumed history preserves tool error state instead of fabricating success', () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      metadata: {
        status: 'error',
        errorText: 'Tool request timed out',
        orderedParts: [
          { type: 'step-start' },
          {
            type: 'tool',
            toolName: 'translateResume',
            state: 'output-error',
            args: { targetLanguage: 'en' },
            errorText: 'Tool request timed out',
          },
        ],
      },
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[0] as UIMessage & {
    metadata?: { status?: string; errorText?: string };
  };
  const toolPart = assistantMessage.parts[1] as {
    state?: string;
    errorText?: string;
    output?: unknown;
  };

  expect(assistantMessage.metadata?.status).toBe('error');
  expect(assistantMessage.metadata?.errorText).toBe('Tool request timed out');
  expect(toolPart.state).toBe('output-error');
  expect(toolPart.errorText).toBe('Tool request timed out');
  expect(toolPart.output).toBe(undefined);
});

test('chat context excludes failed tool outputs from retry context', async () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: 'Please update my summary',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      metadata: {
        status: 'error',
        errorText: 'Bad Request',
        orderedParts: [
          { type: 'step-start' },
          {
            type: 'tool',
            toolName: 'updateSection',
            state: 'output-error',
            args: { sectionId: 'summary', field: 'text', value: 'improved text' },
            errorText: 'Bad Request',
          },
        ],
      },
      createdAt: Date.now(),
    },
    {
      id: 'user-2',
      role: 'user',
      content: 'retry',
      createdAt: Date.now(),
    },
  ]);

  const modelMessages = await buildChatContextMessages(resumedMessages);

  expect(modelMessages.map((message) => message.role)).toEqual(['user', 'user']);
});

test('resumed pending assistant metadata survives even without text parts', () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      metadata: {
        status: 'submitted',
        startedAt: 1234567890,
        orderedParts: [],
      },
      createdAt: Date.now(),
    },
  ]);

  const assistantMessage = resumedMessages[0] as UIMessage & {
    metadata?: { status?: string; startedAt?: number };
  };

  expect(assistantMessage.metadata?.status).toBe('submitted');
  expect(assistantMessage.metadata?.startedAt).toBe(1234567890);
  expect(assistantMessage.parts).toEqual([]);
});

test('resumed history drops legacy empty-response placeholders from display/context', () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'user-1',
      role: 'user',
      content: '继续优化',
      createdAt: Date.now(),
    },
    {
      id: 'assistant-empty',
      role: 'assistant',
      content: '',
      metadata: {
        status: 'error',
        errorKind: 'stream',
        errorText: EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT,
        orderedParts: [],
      },
      createdAt: Date.now(),
    },
  ]);

  expect(resumedMessages.map((message) => message.id)).toEqual(['user-1']);
});

test('resumed history keeps empty-response errors when assistant still has renderable output', () => {
  const resumedMessages = dbMessagesToUIMessages([
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'fallback text',
      metadata: {
        status: 'error',
        errorText: EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT,
        orderedParts: [{ type: 'text', text: 'fallback text' }],
      },
      createdAt: Date.now(),
    },
  ]);

  expect(resumedMessages.length).toBe(1);
  expect(resumedMessages[0]?.id).toBe('assistant-1');
  expect(resumedMessages[0]?.parts.some((part) => part.type === 'text')).toBeTruthy();
});

test('chat context drops assistant messages that only contain empty text parts', async () => {
  const messages: UIMessage[] = [
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Analyze this resume.' }],
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: '' }],
    },
    {
      id: 'user-2',
      role: 'user',
      parts: [{ type: 'text', text: 'Continue with next question.' }],
    },
  ];

  const modelMessages = await buildChatContextMessages(messages);

  expect(modelMessages.map((message) => message.role)).toEqual(['user', 'user']);
});
