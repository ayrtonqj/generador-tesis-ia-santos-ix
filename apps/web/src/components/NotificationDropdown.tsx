'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, Check, Info, AlertTriangle, X } from 'lucide-react';
import { api } from '@/lib/api';

const ICONS: Record<string, React.ReactNode> = {
  SUCCESS: <Check className="w-4 h-4 text-green-500" />,
  WARNING: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  INFO: <Info className="w-4 h-4 text-blue-500" />,
};

function getIcon(type: string) {
  return ICONS[type] || <Bell className="w-4 h-4 text-gray-500" />;
}

interface Props {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: Props) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/notifications')
      .then(r => setNotifications(r.data.slice(0, 5)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const markAsRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">Notificaciones</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="text-[10px] font-bold text-white bg-primary-500 rounded-full px-1.5 py-0.5">
              {notifications.filter(n => !n.read).length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay notificaciones</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`p-3 flex items-start gap-3 transition-colors ${n.read ? 'opacity-60' : 'bg-primary-50/20'}`}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border shadow-sm">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs ${n.read ? 'font-normal text-gray-600' : 'font-semibold text-gray-900'}`}>
                  {n.title}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-gray-400">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                  {!n.read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="text-[10px] font-bold text-primary-500 hover:underline"
                    >
                      LEÍDA
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <Link
        href="/dashboard/notifications"
        onClick={onClose}
        className="block text-center text-xs font-semibold text-primary-600 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors"
      >
        Ver todas las notificaciones
      </Link>
    </div>
  );
}
