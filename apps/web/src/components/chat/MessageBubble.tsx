'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Volume2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { ChatMessage } from './useChat';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isUser = message.role === 'USER';
  const isEmptyAssistant = !isUser && !message.content;

  const handlePlayAudio = async () => {
    if (isPlaying || !message.content) return;
    setIsPlaying(true);
    try {
      const response = await api.post('/chat/text-to-speech', { text: message.content }, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const audio = new Audio(url);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      setIsPlaying(false);
    }
  };

  if (isEmptyAssistant) {
    return (
      <div className="flex gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-primary-500">K</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-gray-200 text-gray-600' : 'bg-primary-500/20 text-primary-500'
      }`}>
        <span className="text-xs font-semibold">{isUser ? 'U' : 'K'}</span>
      </div>

      <div className={`max-w-[80%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary-500 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5 prose-code:bg-gray-200 prose-code:px-1 prose-code:rounded text-gray-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && message.content && (
          <button
            onClick={handlePlayAudio}
            disabled={isPlaying}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary-500 transition px-1"
          >
            {isPlaying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            {isPlaying ? 'Reproduciendo...' : 'Escuchar'}
          </button>
        )}
      </div>
    </div>
  );
}
