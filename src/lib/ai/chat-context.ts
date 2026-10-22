import { convertToModelMessages, type UIMessage } from 'ai';

const MAX_ROUNDS = 10;
export const MAX_CHAT_CONTEXT_MESSAGES = MAX_ROUNDS * 2;

type UIMessagePart = NonNullable<UIMessage['parts']>[number];

function isNonEmptyTextPart(part: UIMessagePart) {
  return part.type !== 'text' || part.text.trim().length > 0;
}

function isMeaningfulPart(part: UIMessagePart) {
  if (part.type === 'step-start') return false;
  if (part.type === 'text') return part.text.trim().length > 0;
  return true;
}

function isRetrySafeToolPart(part: UIMessagePart) {
  if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) return true;
  const state = (part as { state?: string }).state;
  return state === undefined || state === 'output-available';
}

function sanitizeContextMessage(message: UIMessage): UIMessage | null {
  const parts = (message.parts || [])
    .filter(isNonEmptyTextPart)
    .filter(isRetrySafeToolPart);
  if (!parts.some(isMeaningfulPart)) return null;
  return {
    ...message,
    parts,
  };
}

export async function buildChatContextMessages(messages: UIMessage[]) {
  const sanitizedMessages = messages
    .map(sanitizeContextMessage)
    .filter((message): message is UIMessage => message !== null);
  // Limit by UI turns first so tool-call + tool-result model messages stay intact.
  const recentMessages = sanitizedMessages.slice(-MAX_CHAT_CONTEXT_MESSAGES);
  // A fixed-count slice can start mid-turn (assistant/tool message first).
  // Providers that require a user-first context reject that shape, so move
  // the window forward to the first user message.
  while (recentMessages.length > 0 && recentMessages[0].role !== 'user') {
    recentMessages.shift();
  }
  return convertToModelMessages(recentMessages);
}
