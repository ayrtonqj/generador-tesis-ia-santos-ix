'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { X, Download, Mail, FileText, Loader2, AlertTriangle } from 'lucide-react';

interface ReportPreviewModalProps {
  advanceId: string;
  studentName?: string;
  onClose: () => void;
}

export default function ReportPreviewModal({ advanceId, studentName, onClose }: ReportPreviewModalProps) {
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/reports/advance/${advanceId}/html`)
      .then((res) => {
        setHtmlContent(res.data);
      })
      .catch(() => {
        setError('No se pudo cargar la vista previa del reporte.');
      })
      .finally(() => setLoading(false));
  }, [advanceId]);

  const handleDownloadPdf = async () => {
    try {
      const nameRes = await api.get(`/reports/advance/${advanceId}/filename`);
      const fileName = nameRes.data.fileName;

      const res = await api.get(`/reports/advance/${advanceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError('Error al descargar el PDF.');
    }
  };

  const handleSendEmail = async () => {
    try {
      await api.post(`/reports/advance/${advanceId}/send-email`);
      alert('Correo enviado correctamente.');
    } catch (error) {
      alert('Error al enviar el correo: ' + ((error as any)?.response?.data?.message || (error as any).message));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Vista Previa del Reporte</h3>
              {studentName && (
                <p className="text-xs text-gray-500">{studentName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" /> Descargar PDF
            </button>
            <button
              onClick={handleSendEmail}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition flex items-center gap-1.5 active:scale-95"
            >
              <Mail className="w-3.5 h-3.5" /> Enviar por Correo
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              <p className="text-sm text-gray-500">Generando vista previa...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          ) : (
            <div
              className="bg-white shadow-sm rounded-xl p-8 max-w-[210mm] mx-auto"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
