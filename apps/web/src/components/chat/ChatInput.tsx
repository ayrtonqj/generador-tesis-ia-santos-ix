'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, StopCircle } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTranscript = (text: string) => {
    const trimmed = text.trim();
    if (!input.trim() && trimmed) {
      onSend(trimmed);
    } else {
      setInput(prev => prev + (prev ? ' ' : '') + text);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <AudioRecorder onTranscript={handleTranscript} />

        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Esperando respuesta...' : 'Escribe un mensaje...'}
            rows={1}
            disabled={isStreaming}
            className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-xl text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none transition-shadow disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {isStreaming ? (
          <button
            onClick={onStop}
            className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition active:scale-95 flex-shrink-0"
            title="Detener"
          >
            <StopCircle className="w-4.5 h-4.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="p-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
            title="Enviar"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        )}
      </div>
    </div>
  );
}
