'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react';

interface ConversationListItem {
  id: string;
  title: string;
  modelUsed?: string;
  createdAt: string;
  _count: { messages: number };
}

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({ activeId, onSelect, onNew }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Error fetching conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [activeId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await api.delete(`/chat/conversations/${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeId === id) onNew();
    } catch (err) {
      console.error('Error deleting conversation');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nueva conversación
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8 px-4">
            No hay conversaciones aún
          </p>
        ) : (
          <div className="space-y-0.5 p-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full group flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition text-sm ${
                  activeId === conv.id
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                }`}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{conv.title}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); if (deletingId !== conv.id) handleDelete(e, conv.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (deletingId !== conv.id) handleDelete(e as any, conv.id); } }}
                  className={`p-0.5 rounded transition cursor-pointer ${
                    deletingId === conv.id
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-400 hover:text-red-500 hover:bg-gray-200 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {deletingId === conv.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
