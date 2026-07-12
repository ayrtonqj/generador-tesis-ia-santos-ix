'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from './useChat';

interface ChatWindowProps {
  messages: ChatMessage[];
  error: string | null;
}

export function ChatWindow({ messages, error }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <div className="space-y-3 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold text-primary-500">K</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Asistente KIMY</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            Pregúntame sobre tesis, métricas del sistema, normas APA, o estructura de investigación.
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {[
              '¿Cuántas tesis hay aprobadas?',
              '¿Cuál es el promedio general?',
              '¿Cómo estructurar el marco teórico?',
              '¿Qué son las normas APA 7?',
            ].map((q) => (
              <span key={q} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full border border-gray-200">
                {q}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-1">
      {messages.map((msg, i) => (
        <MessageBubble key={msg.id || i} message={msg} />
      ))}

      {error && (
        <div className="px-4 py-2 mx-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
