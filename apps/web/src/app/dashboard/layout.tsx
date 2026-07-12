'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import {
  LayoutDashboard, FileText, Upload, Users, BookTemplate,
  BarChart3, Settings, LogOut, Brain, Shield, BookOpen,
  Bell, ChevronLeft, Menu, Layers, Sparkles, MessageSquare, Languages,
} from 'lucide-react';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { NotificationDropdown } from '@/components/NotificationDropdown';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT'] },
  { href: '/dashboard/advances', label: 'Avances', icon: FileText, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT'] },
  { href: '/dashboard/upload', label: 'Subir Avance', icon: Upload, roles: ['STUDENT'] },
  { href: '/dashboard/thesis-generator', label: 'Generador IA', icon: Sparkles, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT'] },
  { href: '/dashboard/bulk-review', label: 'Revisión Masiva', icon: Layers, roles: ['ADMIN', 'COORDINATOR'] },
  { href: '/dashboard/templates', label: 'Doc. Patrón', icon: BookTemplate, roles: ['ADMIN', 'COORDINATOR'] },
  { href: '/dashboard/users', label: 'Usuarios', icon: Users, roles: ['ADMIN', 'COORDINATOR'] },
  { href: '/dashboard/statistics', label: 'Estadísticas', icon: BarChart3, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR'] },
  { href: '/dashboard/fine-tuning', label: 'Fine-tuning IA', icon: Brain, roles: ['ADMIN'] },
  { href: '/dashboard/plagiarism', label: 'Plagio', icon: Shield, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR'] },
  { href: '/dashboard/references', label: 'Referencias', icon: BookOpen, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR'] },
  { href: '/dashboard/chat', label: 'Chat IA', icon: MessageSquare, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT'] },
  { href: '/dashboard/translator', label: 'Traductor', icon: Languages, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT'] },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings, roles: ['ADMIN', 'COORDINATOR', 'ADVISOR', 'STUDENT'] },
];


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const userData = Cookies.get('kimy_user');
    if (userData) {
      try { setUser(JSON.parse(userData)); } catch { }
    } else {
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    api.get('/notifications/unread-count')
      .then(r => setUnreadCount(r.data?.count ?? 0))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    Cookies.remove('kimy_token');
    Cookies.remove('kimy_user');
    window.location.href = '/login';
  };

  const filteredItems = NAV_ITEMS.filter(
    (item) => !user || item.roles.includes(user.role),
  );

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-60'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 flex-shrink-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100">
          {!collapsed && (
            <div className="flex items-center gap-2.5 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <span className="text-sm font-bold text-white">K</span>
              </div>
              <span className="text-base font-semibold text-gray-900">TESIS-UNT</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`${collapsed ? 'mx-auto' : 'ml-auto'} p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors`}
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group ${isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-3">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary-700">
                {user.name?.charAt(0) || 'U'}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-[10px] text-gray-500">{user.role}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={handleLogout} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {filteredItems.find((i) => pathname.startsWith(i.href))?.label || 'KIMY'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-4.5 h-4.5 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-primary-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      <ChatWidget />
    </div>
  );
}
