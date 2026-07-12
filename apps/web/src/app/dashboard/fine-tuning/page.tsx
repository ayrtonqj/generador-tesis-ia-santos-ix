'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Brain, Download, Play, CheckCircle } from 'lucide-react';

export default function FineTuningPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/fine-tuning/stats')
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const downloadDataset = async () => {
    try {
      const res = await api.post('/fine-tuning/export', null, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'dataset.jsonl');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Fine-tuning IA</h1>
          <p className="text-sm text-gray-500 mt-0.5">Entrenamiento continuo del modelo GPT-4o con feedback humano</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats?.totalPairs || 0}</p>
          <p className="text-sm text-gray-500">Pares recolectados</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <div className="flex justify-between items-start mb-2">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats?.modelsTrained || 0}</p>
          <p className="text-sm text-gray-500">Modelos entrenados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats?.byOutcome?.map((outcome: any) => (
          <div key={outcome.outcomeType} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p className="text-sm font-semibold text-gray-700">{outcome.outcomeType}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{outcome._count._all}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Exportar Dataset</h3>
        <p className="text-sm text-gray-500 mb-6">
          Descarga los datos recopilados en formato JSONL compatible con la API de OpenAI para realizar el proceso de fine-tuning.
        </p>
        <div className="flex gap-3">
          <button onClick={downloadDataset} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Descargar JSONL
          </button>
          <button className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition flex items-center gap-2">
            <Play className="w-4 h-4" /> Iniciar Entrenamiento Automático
          </button>
        </div>
      </div>
    </div>
  );
}
