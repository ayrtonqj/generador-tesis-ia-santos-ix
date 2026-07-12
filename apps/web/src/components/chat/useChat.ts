'use client';

import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

export interface ChatMessage {
  id?: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  createdAt?: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    setIsStreaming(true);

    const userMsg: ChatMessage = { role: 'USER', content: text };
    const assistantMsg: ChatMessage = { role: 'ASSISTANT', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('kimy_token='))
        ?.split('=')[1];

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(
          conversationId ? { conversationId, message: text } : { message: text }
        ),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            switch (parsed.type) {
              case 'text':
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'ASSISTANT') {
                    updated[updated.length - 1] = { ...last, content: last.content + parsed.content };
                  }
                  return updated;
                });
                break;

              case 'tool_calls':
              case 'tool_result':
                break;

              case 'conversation_created':
                setConversationId(parsed.conversationId);
                break;

              case 'done':
                if (parsed.conversationId) {
                  setConversationId(parsed.conversationId);
                }
                break;

              case 'error':
                setError(parsed.content);
                break;

              case 'stream_end':
                break;
            }
          } catch (e) {
            // skip unparseable chunks
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Streaming cancelado');
      } else {
        setError(err.message || 'Error de conexión');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [conversationId, isStreaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/chat/conversations/${id}/messages`);
      setMessages(res.data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })));
      setConversationId(id);
      setError(null);
    } catch (err: any) {
      setError('Error al cargar conversación');
    }
  }, []);

  return {
    messages,
    isStreaming,
    conversationId,
    error,
    sendMessage,
    stopStreaming,
    resetChat,
    loadConversation,
    setMessages,
    setConversationId,
  };
}
