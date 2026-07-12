'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Bell, Check, Clock, Info, AlertTriangle, Trash2 } from 'lucide-react';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    api.get('/notifications')
      .then(r => setNotifications(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    await api.patch('/notifications/mark-all-read');
    fetchNotifications();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS': return <Check className="w-4 h-4 text-green-500" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'INFO': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Centro de Notificaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mantente al tanto de las actualizaciones de tus tesis</p>
        </div>
        {notifications.length > 0 && (
          <button 
            onClick={markAllAsRead}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 divide-y">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Cargando notificaciones...</div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-500">No tienes notificaciones pendientes</p>
          </div>
        ) : (
          notifications.map((n) => {
            const advanceId = n.data?.advanceId as string | undefined;
            const handleClick = () => {
              if (advanceId) {
                router.push(`/dashboard/advances/${advanceId}`);
              }
            };
            return (
              <div
                key={n.id}
                onClick={handleClick}
                className={`p-4 flex items-start gap-4 transition-colors cursor-pointer ${advanceId ? 'hover:bg-gray-50' : ''} ${n.read ? 'opacity-60' : 'bg-primary-50/10'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.read ? 'bg-gray-100' : 'bg-white border shadow-sm'}`}>
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm ${n.read ? 'font-normal text-gray-600' : 'font-semibold text-gray-900'}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {!n.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        className="text-[10px] font-bold text-primary-500 hover:underline"
                      >
                        MARCAR COMO LEÍDA
                      </button>
                    )}
                    {advanceId && (
                      <span className="text-[10px] text-gray-400">Click para ver avance</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
