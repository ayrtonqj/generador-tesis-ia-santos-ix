'use client';

import { useCallback, useEffect } from 'react';
import { useChat } from './useChat';
import { ConversationList } from './ConversationList';
import { ChatWindow } from './ChatWindow';
import { ChatInput } from './ChatInput';

export function ChatPage() {
  const {
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
  } = useChat();

  const handleSend = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <ConversationList
        activeId={conversationId}
        onSelect={loadConversation}
        onNew={resetChat}
      />

      <div className="flex-1 flex flex-col">
        <ChatWindow messages={messages} error={error} />

        <ChatInput
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
