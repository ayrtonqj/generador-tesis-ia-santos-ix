'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, X, Maximize2, Trash2 } from 'lucide-react';
import { useChat } from './useChat';
import { ChatWindow } from './ChatWindow';
import { ChatInput } from './ChatInput';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    resetChat,
  } = useChat();

  const handleSend = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg hover:bg-primary-600 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center"
        title="Abrir Chat IA"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-primary-500 text-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-xs font-bold text-white">K</span>
          </div>
          <span className="text-sm font-semibold">Chat IA</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/chat"
            className="p-1.5 rounded-lg hover:bg-white/20 transition"
            title="Abrir en página completa"
          >
            <Maximize2 className="w-4 h-4" />
          </Link>
          <button
            onClick={resetChat}
            className="p-1.5 rounded-lg hover:bg-white/20 transition"
            title="Nueva conversación"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ChatWindow messages={messages} error={error} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
}
