'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResumeStore } from '@/stores/resume-store';
import { useSettingsStore, getAIHeaders } from '@/stores/settings-store';
import { generateId } from '@/lib/utils';
import type { AIChatStatus, AIChatUIMessage } from '@/types/ai';
import {
  saveCurrentResumeVersion,
  syncResumeFromServer,
} from '@/lib/editor/resume-history-actions';
import { countCompletedToolParts, getNextToolResultReloadState } from '@/lib/ai/chat-stream-state';
import {
  EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT,
  hasRenderableAssistantReplySinceRequest,
  hasRenderableUIAssistantMessage,
  shouldSurfaceEmptyAssistantResponseError,
} from '@/lib/ai/chat-response-status';

interface UseAIChatOptions {
  resumeId: string;
  sessionId?: string;
  initialMessages?: AIChatUIMessage[];
  selectedModel?: string;
}

export interface AIStreamActivity {
  startedAt?: number;
  firstTokenAt?: number;
  lastTokenAt?: number;
  hasReceivedToken?: boolean;
}

function getMessageText(message?: AIChatUIMessage) {
  if (!message?.parts) return '';
  return message.parts
    .filter((part): part is { type: 'text'; text: string } =>
      part.type === 'text' && 'text' in part && typeof part.text === 'string'
    )
    .map((part) => part.text)
    .join('');
}

function getLatestAssistantText(messages: AIChatUIMessage[]) {
  const latestAssistantMessage = getLatestAssistantMessage(messages);
  return getMessageText(latestAssistantMessage);
}

function getLatestAssistantMessage(messages: AIChatUIMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'assistant');
}


export function useAIChat({ resumeId, sessionId, initialMessages, selectedModel }: UseAIChatOptions) {
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<AIChatUIMessage[]>([]);
  const [lastTerminalStatus, setLastTerminalStatus] = useState<AIChatStatus | undefined>();
  const [terminalSessionId, setTerminalSessionId] = useState<string | undefined>();
  const [streamStartedAt, setStreamStartedAt] = useState<number | undefined>();
  const [preflightError, setPreflightError] = useState<Error | null>(null);
  const [requestBaselineAssistantId, setRequestBaselineAssistantId] = useState<string | undefined>();
  const [requestBaselineAssistantWasRenderable, setRequestBaselineAssistantWasRenderable] = useState(false);

  // useChat only recreates its internal Chat when `id` changes; a transport
  // object rebuilt by useMemo is never picked up. Per-request values therefore
  // travel in the sendMessage/regenerate body, which is built fresh on every
  // call, instead of being captured by the transport.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        // headers must be a function — useChat never updates the transport ref,
        // so a static object would freeze stale values from before store hydration.
        headers: () => {
          const fp = typeof window !== 'undefined' ? localStorage.getItem('jade_fingerprint') : null;
          return { ...(fp ? { 'x-fingerprint': fp } : {}), ...getAIHeaders() };
        },
      }),
    []
  );


  const {
    messages,
    sendMessage: rawSendMessage,
    regenerate: rawRegenerate,
    status,
    error,
    setMessages,
    stop,
    clearError,
  } = useChat<AIChatUIMessage>({
    id: sessionId,
    transport,
  });


  const latestAssistantMessage = getLatestAssistantMessage(messages);
  const hasRenderableAssistantReply = hasRenderableAssistantReplySinceRequest(
    latestAssistantMessage,
    requestBaselineAssistantId,
    requestBaselineAssistantWasRenderable
  );
  const emptyResponseError = useMemo(
    () => (
      shouldSurfaceEmptyAssistantResponseError({
        sessionId,
        terminalSessionId,
        requestStatus: status,
        terminalStatus: lastTerminalStatus,
        hasRenderableAssistantReply,
      })
        ? new Error(EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT)
        : null
    ),
    [hasRenderableAssistantReply, lastTerminalStatus, sessionId, status, terminalSessionId]
  );

  const isLoading = status === 'streaming' || status === 'submitted';
  const terminalStatus = terminalSessionId === sessionId
    ? lastTerminalStatus
      || (status === 'error' || Boolean(emptyResponseError) ? 'error' : status === 'ready' && terminalSessionId ? 'completed' : undefined)
    : undefined;

  // Track completed tool call count to detect new tool results
  const completedToolCountRef = useRef(0);
  // Serializes reloadResume calls so a stale response cannot win.
  const reloadRequestIdRef = useRef(0);

  const startStreamActivity = useCallback(() => {
    setStreamStartedAt(Date.now());
  }, []);

  const resetStreamActivity = useCallback(() => {
    setStreamStartedAt(undefined);
  }, []);

  const sendChatMessage = useCallback(
    async (...args: Parameters<typeof rawSendMessage>) => {
      try {
        // Upstream #96: flush the pending debounced save before the server
        // reads the resume. This is the same path the other AI entry points use.
        await useResumeStore.getState().flushSave();
        setPreflightError(null);
      } catch (syncError) {
        const typedError = syncError instanceof Error
          ? syncError
          : new Error('Failed to sync the latest resume before sending AI request.');
        setPreflightError(typedError);
        throw typedError;
      }
      const baselineAssistantMessage = getLatestAssistantMessage(messages);
      setRequestBaselineAssistantId(baselineAssistantMessage?.id);
      setRequestBaselineAssistantWasRenderable(hasRenderableUIAssistantMessage(baselineAssistantMessage));
      startStreamActivity();
      const [message, requestOptions] = args;
      return rawSendMessage(message, {
        ...requestOptions,
        body: {
          ...(requestOptions?.body as Record<string, unknown> | undefined),
          resumeId,
          model: selectedModel,
          sessionId,
        },
      });
    },
    [messages, rawSendMessage, startStreamActivity, resumeId, selectedModel, sessionId]
  );

  const reloadResume = useCallback(async () => {
    if (!resumeId) return;
    const requestId = ++reloadRequestIdRef.current;
    try {
      const store = useResumeStore.getState();
      // Cancel any pending autosave to prevent overwriting server data
      if (store._saveTimeout) clearTimeout(store._saveTimeout);
      useResumeStore.setState({ _saveTimeout: null });

      // Flush pending local edits first so the reload doesn't clobber them.
      if (store.isDirty && !store.isSaving) {
        await store.save({ source: 'autosave' });
      }

      if (useResumeStore.getState().currentResume) {
        await saveCurrentResumeVersion('checkpoint');
      }

      const fp = typeof window !== 'undefined' ? localStorage.getItem('jade_fingerprint') : null;
      const res = await fetch(`/api/resume/${resumeId}`, {
        headers: fp ? { 'x-fingerprint': fp } : {},
      });
      if (res.ok) {
        // Ignore a response that a newer reload (or a resume switch) made
        // obsolete; otherwise an older snapshot can overwrite newer state.
        if (requestId !== reloadRequestIdRef.current) return;
        const state = useResumeStore.getState();
        if (!state.currentResume || state.currentResume.id !== resumeId) return;
        // If the user started editing while we were fetching, don't overwrite
        // their newer work with the (older) server snapshot.
        if (state.isDirty) return;
        const resume = await res.json();
        if (requestId !== reloadRequestIdRef.current) return;
        await syncResumeFromServer(resume, {
          recordHistory: true,
          saveVersion: true,
          source: 'ai',
        });
      }
    } catch (err) {
      console.error('Failed to reload resume after tool call:', err);
    }
  }, [resumeId]);

  // Reload resume data when new tool results appear during streaming
  useEffect(() => {
    const nextState = getNextToolResultReloadState(completedToolCountRef.current, messages);

    if (nextState.shouldReload) {
      completedToolCountRef.current = nextState.completedToolCount;
      reloadResume();
    }
  }, [messages, reloadResume]);

  // Load initial messages when session changes; sync tool count ref to avoid false reload
  useEffect(() => {
    if (initialMessages) {
      // Pre-calculate tool count from initial messages to avoid triggering a redundant reload
      completedToolCountRef.current = countCompletedToolParts(initialMessages);
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Check if API key is configured
    const { aiApiKey, serverAIConfigured } = useSettingsStore.getState();
    if (!aiApiKey && !serverAIConfigured) {
      const userMsg: AIChatUIMessage = {
        id: generateId(),
        role: 'user',
        parts: [{ type: 'text', text: input }],
      };
      const errorMsg: AIChatUIMessage = {
        id: generateId(),
        role: 'assistant',
        parts: [{ type: 'text', text: '__API_KEY_MISSING__' }],
      };
      // Keep these messages separate from useChat state so they never get sent to the server
      setLocalMessages((prev) => [...prev, userMsg, errorMsg]);
      setInput('');
      return;
    }

    // Clear local-only messages when user starts a real conversation
    if (localMessages.length > 0) {
      setLocalMessages([]);
    }


    clearError();
    setPreflightError(null);
    setTerminalSessionId(sessionId);
    setLastTerminalStatus(undefined);
    // Clear the input only once the message was actually submitted — if the
    // preflight (resume sync) fails, the send throws and the typed text would
    // otherwise be wiped for nothing.
    void sendChatMessage({ text: input }).then(() => {
      setInput('');
    }).catch((sendError) => {
      console.error('Failed to send AI message:', sendError);
      resetStreamActivity();
      setTerminalSessionId(sessionId);
      setLastTerminalStatus('error');
    });
  }, [clearError, input, localMessages, resetStreamActivity, sendChatMessage, sessionId]);

  const latestAssistantText = getLatestAssistantText(messages);

  // Merge real chat messages with local-only display messages
  const allMessages = useMemo(
    () => (localMessages.length > 0 ? [...messages, ...localMessages] : messages),
    [messages, localMessages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLocalMessages([]);
    setPreflightError(null);
    setRequestBaselineAssistantId(undefined);
    setRequestBaselineAssistantWasRenderable(false);
    setTerminalSessionId(undefined);
    setLastTerminalStatus(undefined);
    resetStreamActivity();
  }, [resetStreamActivity, setMessages]);

  const stopStreaming = useCallback(() => {
    setTerminalSessionId(sessionId);
    setLastTerminalStatus('aborted');
    resetStreamActivity();
    stop();
  }, [resetStreamActivity, sessionId, stop]);

  const retryAssistantMessage = useCallback(async (assistantMessageId?: string) => {
    if (!sessionId) return;
    const targetAssistantMessage = assistantMessageId
      ? messages.find((message) => message.id === assistantMessageId && message.role === 'assistant')
      : getLatestAssistantMessage(messages);
    if (!targetAssistantMessage) return;

    clearError();
    setPreflightError(null);
    setTerminalSessionId(sessionId);
    setLastTerminalStatus(undefined);
    // Do not baseline on the message being retried: regenerate reuses its id,
    // so a baseline of "this id was already renderable" made a successful
    // retry look like an empty response. An absent baseline means any
    // renderable content counts as a reply.
    setRequestBaselineAssistantId(undefined);
    setRequestBaselineAssistantWasRenderable(false);

    // A retry is another AI request: flush pending edits first, otherwise the
    // server regenerates from the older persisted resume (upstream #96).
    try {
      await useResumeStore.getState().flushSave();
    } catch (syncError) {
      setPreflightError(
        syncError instanceof Error
          ? syncError
          : new Error('Failed to sync the latest resume before retrying.')
      );
      return;
    }

    startStreamActivity();

    try {
      await rawRegenerate({
        messageId: targetAssistantMessage.id,
        body: { resumeId, model: selectedModel, sessionId },
      });
    } catch (retryError) {
      console.error('Failed to retry AI message:', retryError);
      resetStreamActivity();
      setTerminalSessionId(sessionId);
      setLastTerminalStatus('error');
    }
  }, [
    clearError,
    messages,
    rawRegenerate,
    resetStreamActivity,
    resumeId,
    selectedModel,
    sessionId,
    startStreamActivity,
  ]);

  const resetTerminalState = useCallback(() => {
    setRequestBaselineAssistantId(undefined);
    setRequestBaselineAssistantWasRenderable(false);
    setTerminalSessionId(undefined);
    setLastTerminalStatus(undefined);
    resetStreamActivity();
  }, [resetStreamActivity]);

  return {
    messages: allMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    status,
    error: preflightError ?? emptyResponseError ?? error,
    streamActivity: { startedAt: streamStartedAt, hasReceivedToken: latestAssistantText.length > 0 },
    lastTerminalStatus: terminalStatus,
    clearMessages,
    sendMessage: sendChatMessage,
    retryAssistantMessage,
    stopStreaming,
    resetTerminalState,
  };
}
