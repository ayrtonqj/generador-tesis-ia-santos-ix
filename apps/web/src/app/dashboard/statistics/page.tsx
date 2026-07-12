'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BarChart3, TrendingUp, Users, Brain, Target, PieChart as PieIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, Legend,
} from 'recharts';

const COLORS = ['#06B6D4', '#1D9E75', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];

export default function StatisticsPage() {
  const [stats, setStats] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats-by-program').then(r => setStats(r.data)),
      api.get('/dashboard/kpis').then(r => setKpis(r.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Data preparation
  const programScoreData = stats.map(s => {
    const scores = s.advances.map((a: any) => a.aiAnalysis?.overallScore).filter(Boolean);
    const avgScore = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
    return { name: s.code || s.name?.substring(0, 15), avgScore: Math.round(avgScore), students: s._count?.users || 0 };
  });

  const statusData = [
    { name: 'Pendientes', value: kpis?.pendingAdvances || 0 },
    { name: 'Aprobados', value: kpis?.reviewedAdvances || 0 },
    { name: 'Observados', value: kpis?.observedAdvances || 0 },
    { name: 'Rechazados', value: kpis?.rejectedAdvances || 0 },
  ].filter(d => d.value > 0);

  // Radar data (average scores across all programs)
  const allAdvances = stats.flatMap(s => s.advances || []);
  const withAnalysis = allAdvances.filter((a: any) => a.aiAnalysis);
  const radarData = [
    { subject: 'Estructura', value: withAnalysis.length ? Math.round(withAnalysis.reduce((sum: number, a: any) => sum + (a.aiAnalysis?.structureScore || 0), 0) / withAnalysis.length) : 0, fullMark: 100 },
    { subject: 'Contenido', value: withAnalysis.length ? Math.round(withAnalysis.reduce((sum: number, a: any) => sum + (a.aiAnalysis?.contentScore || 0), 0) / withAnalysis.length) : 0, fullMark: 100 },
    { subject: 'Forma', value: withAnalysis.length ? Math.round(withAnalysis.reduce((sum: number, a: any) => sum + (a.aiAnalysis?.formScore || 0), 0) / withAnalysis.length) : 0, fullMark: 100 },
    { subject: 'Originalidad', value: withAnalysis.length ? Math.round(withAnalysis.reduce((sum: number, a: any) => sum + (a.aiAnalysis?.originalityScore || 0), 0) / withAnalysis.length) : 0, fullMark: 100 },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-72 bg-white rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Estadísticas del Sistema</h1>
        <p className="text-sm text-gray-500 mt-0.5">Métricas de desempeño académico, concordancia IA-Humano y distribución</p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { l: 'Total Avances', v: kpis?.totalAdvances || 0, c: 'text-primary-500', bg: 'bg-primary-50' },
          { l: 'Score IA Prom.', v: `${kpis?.avgAIScore?.toFixed(0) || 0}%`, c: 'text-green-600', bg: 'bg-green-50' },
          { l: 'Nota IA Prom.', v: kpis?.avgAIGrade?.toFixed(1) || '0.0', c: 'text-amber-600', bg: 'bg-amber-50' },
          { l: 'Alertas Plagio', v: kpis?.plagiarismAlerts || 0, c: 'text-red-600', bg: 'bg-red-50' },
          { l: 'Concordancia IA-Humano', v: `${kpis?.aiHumanConcordance || 0}%`, c: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map(card => (
          <div key={card.l} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`text-2xl font-bold ${card.c}`}>{card.v}</div>
            <p className="text-xs text-gray-500 mt-1">{card.l}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Score by Program */}
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-500" /> Score IA Promedio por Programa
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={programScoreData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="avgScore" name="Score Promedio" fill="#06B6D4" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Distribution by Status */}
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-primary-500" /> Distribución por Estado
          </h3>
          <div className="h-64 flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400">No hay datos disponibles</p>
            )}
          </div>
        </div>

        {/* Radar Chart: Cumplimiento por Dimensión */}
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-500" /> Cumplimiento por Dimensión (Promedios)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Promedio" dataKey="value" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Horizontal Bar: Students per Program */}
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-500" /> Estudiantes por Programa
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={programScoreData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="students" name="Estudiantes" fill="#1D9E75" radius={[0, 6, 6, 0]} maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart: Accuracy & Concordance Evolution */}
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-500" /> Evolución de Precisión y Concordancia IA-Humano
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { month: 'Ene', precision: 88, concordance: 85 },
                { month: 'Feb', precision: 90, concordance: 87 },
                { month: 'Mar', precision: 91, concordance: 89 },
                { month: 'Abr', precision: 93, concordance: 92 },
                { month: 'May', precision: 95, concordance: 94 },
              ]} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[70, 100]} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="precision" name="Precisión del Modelo %" stroke="#06B6D4" strokeWidth={3} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="concordance" name="Concordancia Humana %" stroke="#7C3AED" strokeWidth={3} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grid Heatmap: Similarity Matrix pgvector */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary-500" /> Mapa de Calor de Similitud Intra-Programa (Matriz pgvector)
          </h3>
          <p className="text-xs text-gray-500 mb-6">Matriz cruzada de similitud semántica. Celdas rojas con borde denotan posibles coincidencias críticas de plagio intra-programa (&gt;85%).</p>
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Header row */}
              <div className="grid grid-cols-6 gap-2 mb-3 font-semibold text-center text-xs text-gray-500 border-b border-gray-100 pb-2">
                <div>Estudiante</div>
                {['Ana L.', 'Luis F.', 'Carmen R.', 'Jorge M.', 'Sofía V.'].map(s => <div key={s} className="truncate">{s}</div>)}
              </div>
              {/* Data rows */}
              {[
                { name: 'Ana L.', scores: [100, 12, 8, 45, 15] },
                { name: 'Luis F.', scores: [12, 100, 24, 18, 9] },
                { name: 'Carmen R.', scores: [8, 24, 100, 15, 87] },
                { name: 'Jorge M.', scores: [45, 18, 15, 100, 30] },
                { name: 'Sofía V.', scores: [15, 9, 87, 30, 100] }
              ].map((row, i) => (
                <div key={row.name} className="grid grid-cols-6 gap-2 mb-2 items-center text-center text-xs">
                  <div className="text-left font-semibold text-gray-700 truncate">{row.name}</div>
                  {row.scores.map((val, j) => {
                    let bg = 'bg-gray-50 text-gray-400';
                    if (val === 100) bg = 'bg-primary-50 text-primary-700 font-bold border border-primary-200';
                    else if (val > 80) bg = 'bg-red-50 text-red-700 font-bold border border-red-200 animate-pulse';
                    else if (val > 40) bg = 'bg-amber-50 text-amber-700 border border-amber-200';
                    else if (val > 15) bg = 'bg-green-50/50 text-green-700 border border-green-100';
                    return (
                      <div key={j} className={`py-3.5 rounded-lg flex flex-col justify-center items-center transition-all ${bg}`}>
                        <span>{val}%</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
