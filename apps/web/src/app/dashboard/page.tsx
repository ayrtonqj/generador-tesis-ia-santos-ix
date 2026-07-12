'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  FileText, Clock, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, Users, Brain,
} from 'lucide-react';

interface KPIs {
  totalAdvances: number;
  pendingAdvances: number;
  reviewedAdvances: number;
  rejectedAdvances: number;
  observedAdvances: number;
  avgAIScore: number;
  avgAIGrade: number;
  avgHumanGrade: number;
  plagiarismAlerts: number;
  aiHumanConcordance: number;
  recentActivity: any[];
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/kpis')
      .then((res) => setKpis(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Avances', value: kpis?.totalAdvances || 0, icon: FileText, color: 'text-primary-500', bg: 'bg-primary-50' },
    { label: 'Pendientes', value: kpis?.pendingAdvances || 0, icon: Clock, color: 'text-warning-500', bg: 'bg-warning-50' },
    { label: 'Alertas Plagio', value: kpis?.plagiarismAlerts || 0, icon: AlertTriangle, color: 'text-danger-500', bg: kpis?.plagiarismAlerts ? 'bg-danger-100 animate-pulse' : 'bg-danger-50' },
    { label: 'Concordancia IA-Humano', value: `${kpis?.aiHumanConcordance || 0}%`, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Nota Prom. IA', value: kpis?.avgAIGrade?.toFixed(1) || '0.0', icon: Brain, color: 'text-accent-500', bg: 'bg-accent-50' },
    { label: 'Nota Prom. Humana', value: kpis?.avgHumanGrade?.toFixed(1) || '0.0', icon: TrendingUp, color: 'text-primary-500', bg: 'bg-primary-50' },
    { label: 'Aprobados', value: kpis?.reviewedAdvances || 0, icon: CheckCircle, color: 'text-success-500', bg: 'bg-success-50' },
    { label: 'Score IA Prom.', value: `${kpis?.avgAIScore?.toFixed(0) || 0}%`, icon: Brain, color: 'text-success-500', bg: 'bg-success-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vista general del sistema de revisión de tesis</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-4.5 h-4.5 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Actividad reciente</h3>
        <div className="space-y-3">
          {(kpis?.recentActivity || []).slice(0, 8).map((activity: any) => (
            <div key={activity.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 truncate">{activity.message}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(activity.createdAt).toLocaleString('es-PE')}
                </p>
              </div>
            </div>
          ))}
          {(!kpis?.recentActivity || kpis.recentActivity.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-6">No hay actividad reciente</p>
          )}
        </div>
      </div>
    </div>
  );
}
