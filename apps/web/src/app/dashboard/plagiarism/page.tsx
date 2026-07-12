'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Shield, AlertCircle, ExternalLink, Search, CheckCircle } from 'lucide-react';

export default function PlagiarismDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/advances'),
      // Aquí podrías agregar un endpoint de stats global
    ]).then(([adv]) => {
      setAdvances(adv.data.filter((a: any) => a.status !== 'PENDING'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Detección de Plagio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitoreo de originalidad y similitud entre tesis</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white border rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar tesis..." className="text-sm outline-none w-48" />
          </div>
        </div>
      </div>

      {/* Stats */}
      {(() => {
        const withReports = advances.filter((a: any) => a.plagiarismReports?.[0]);
        const avgSim = withReports.length > 0 ? withReports.reduce((sum: number, a: any) => sum + (a.plagiarismReports[0].overallScore || 0), 0) / withReports.length : 0;
        const criticalCount = withReports.filter((a: any) => a.plagiarismReports[0].overallScore > 30).length;
        return (
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">Promedio de Similitud</p>
          <p className="text-2xl font-bold text-gray-900">{avgSim.toFixed(1)}%</p>
          <div className={`mt-2 flex items-center gap-1 text-[10px] ${avgSim > 25 ? 'text-red-600' : 'text-green-600'}`}>
            {avgSim > 25 ? <AlertCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
            <span>{avgSim > 25 ? 'Nivel elevado' : 'Nivel aceptable'}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">Alertas Críticas</p>
          <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-red-600">
            <AlertCircle className="w-3 h-3" /> <span>{criticalCount > 0 ? 'Requiere atención' : 'Todo limpio'}</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">Tesis Analizadas</p>
          <p className="text-2xl font-bold text-gray-900">{withReports.length}</p>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-600">
            <Shield className="w-3 h-3" /> <span>Protección activa</span>
          </div>
        </div>
      </div>
        );
      })()}

      {/* Lista de hallazgos */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-900">Reportes de Originalidad Recientes</h3>
        </div>
        <div className="divide-y">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Cargando reportes...</div>
          ) : advances.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No hay análisis de plagio completados aún.</div>
          ) : (
            advances.map((adv) => (
              <div key={adv.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${adv.plagiarismReports?.[0]?.overallScore > 30 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{adv.title}</p>
                    <p className="text-xs text-gray-500">{adv.student?.name} · {adv.advanceType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${adv.plagiarismReports?.[0]?.overallScore > 70 ? 'text-red-600' : 'text-gray-900'}`}>
                      {adv.plagiarismReports?.[0]?.overallScore !== undefined ? adv.plagiarismReports[0].overallScore.toFixed(1) : '0.0'}%
                    </p>
                    <p className="text-[10px] text-gray-400">Similitud</p>
                  </div>
                  <a href={`/dashboard/advances/${adv.id}`} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
