'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BookOpen, CheckCircle, XCircle, AlertCircle, Search } from 'lucide-react';

export default function ReferencesPage() {
  const [refs, setRefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/references/all')
      .then(r => setRefs(r.data))
      .catch(() => setRefs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Validación de Referencias</h1>
          <p className="text-sm text-gray-500 mt-0.5">Verificación de citas bibliográficas con CrossRef y Google Scholar</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Total Referencias</p><p className="text-xl font-bold text-gray-900">{refs.length}</p></div>
          <BookOpen className="w-8 h-8 text-blue-100" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Verificadas Exactas</p><p className="text-xl font-bold text-green-600">{refs.filter((r: any) => r.status === 'VERIFIED').length}</p></div>
          <CheckCircle className="w-8 h-8 text-green-100" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">Coincidencia Parcial</p><p className="text-xl font-bold text-amber-600">{refs.filter((r: any) => r.status === 'PARTIAL').length}</p></div>
          <AlertCircle className="w-8 h-8 text-amber-100" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
          <div><p className="text-xs text-gray-500">No Encontradas / Inválidas</p><p className="text-xl font-bold text-red-600">{refs.filter((r: any) => r.status === 'NOT_FOUND' || r.status === 'HALLUCINATED').length}</p></div>
          <XCircle className="w-8 h-8 text-red-100" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar por autor o título..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Referencia</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">DOI</th>
              <th className="px-4 py-3 font-medium">Sugerencia</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400">Cargando base de datos de referencias...</td></tr>
            ) : refs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-16">
                  <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">No hay referencias validadas aún</p>
                </td>
              </tr>
            ) : (
              refs.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-4 max-w-md">
                    <p className="font-medium text-gray-900 line-clamp-2">{r.rawText}</p>
                    {r.authors && <p className="text-xs text-gray-400 mt-1">{r.authors} ({r.year})</p>}
                  </td>
                  <td className="px-4 py-4">
                    {r.status === 'VERIFIED' ? (
                      <span className="flex items-center gap-1.5 text-green-600 font-medium"><CheckCircle className="w-4 h-4" /> Verificada</span>
                    ) : r.status === 'PARTIAL' ? (
                      <span className="flex items-center gap-1.5 text-amber-600 font-medium"><AlertCircle className="w-4 h-4" /> Parcial</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-red-600 font-medium"><AlertCircle className="w-4 h-4" /> No encontrada</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-blue-600">{r.doi || '—'}</td>
                  <td className="px-4 py-4 text-xs text-gray-500">{r.suggestion || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
