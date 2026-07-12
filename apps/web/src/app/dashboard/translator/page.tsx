'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Loader2, Languages, Clock } from 'lucide-react';

const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'Inglés' },
  { code: 'pt', name: 'Portugués' },
  { code: 'fr', name: 'Francés' },
  { code: 'de', name: 'Alemán' },
  { code: 'it', name: 'Italiano' },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Preparando...',
  DETECTING_LANG: 'Detectando idioma...',
  TRANSLATING: 'Traduciendo...',
  COMPLETED: 'Traducción completada',
  FAILED: 'Error en la traducción',
};

type Step = 'upload' | 'translate' | 'result';

export default function TranslatorPage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState('en');
  const [sourceLang, setSourceLang] = useState('auto');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [translationId, setTranslationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [chunkCount, setChunkCount] = useState(0);
  const [completedChunks, setCompletedChunks] = useState(0);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/document-translation/history');
      setHistory(res.data);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    return () => stopPolling();
  }, [fetchHistory, stopPolling]);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/document-translation/${id}`);
        const data = res.data;
        setStatus(data.status);
        setChunkCount(data.chunkCount || 0);
        setCompletedChunks(data.completedChunks || 0);
        if (data.detectedLang) {
          setDetectedLang(data.detectedLang);
        }
        if (data.modelUsed) {
          setModelUsed(data.modelUsed);
        }

        if (data.status === 'COMPLETED') {
          setTranslatedContent(data.translatedContent);
          setStep('result');
          stopPolling();
          fetchHistory();
        } else if (data.status === 'FAILED') {
          setErrorMessage(data.errorMessage);
          setStep('result');
          stopPolling();
          fetchHistory();
        } else {
          setStep('translate');
        }
      } catch {
        stopPolling();
        setMsg('Error al consultar el estado de la traducción');
      }
    }, 2000);
  }, [stopPolling, fetchHistory]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('targetLang', targetLang);
    fd.append('sourceLang', sourceLang);

    try {
      const res = await api.post('/document-translation/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const id = res.data.id;
      setTranslationId(id);
      setStatus('PENDING');
      setStep('translate');
      setChunkCount(0);
      setCompletedChunks(0);
      setDetectedLang(null);
      setTranslatedContent(null);
      setErrorMessage(null);
      setModelUsed(null);
      startPolling(id);
      fetchHistory();
    } catch (err: any) {
      setMsg('Error: ' + (err.response?.data?.message || 'No se pudo subir el archivo'));
      setUploading(false);
    } finally {
      setUploading(false);
    }
  };

  const viewHistoryItem = async (id: string) => {
    setMsg('');
    setErrorMessage(null);
    try {
      const res = await api.get(`/document-translation/${id}`);
      const data = res.data;
      setTranslationId(data.id);
      setStatus(data.status);
      setSourceLang(data.sourceLang);
      setDetectedLang(data.detectedLang);
      setTargetLang(data.targetLang);
      setTranslatedContent(data.translatedContent);
      setErrorMessage(data.errorMessage);
      setChunkCount(data.chunkCount || 0);
      setCompletedChunks(data.completedChunks || 0);
      setModelUsed(data.modelUsed);

      if (data.status === 'COMPLETED') {
        setStep('result');
        stopPolling();
      } else if (data.status === 'FAILED') {
        setStep('result');
        stopPolling();
      } else {
        setStep('translate');
        startPolling(data.id);
      }
    } catch {
      setMsg('Error al cargar la traducción del historial');
    }
  };

  const handleRetry = async () => {
    if (!translationId) return;
    setUploading(true);
    setMsg('');
    setErrorMessage(null);
    try {
      await api.post(`/document-translation/${translationId}/retry`);
      setStatus('PENDING');
      setStep('translate');
      setChunkCount(0);
      setCompletedChunks(0);
      setModelUsed(null);
      startPolling(translationId);
      fetchHistory();
    } catch (err: any) {
      setMsg('Error: ' + (err.response?.data?.message || 'No se pudo reintentar la traducción'));
    } finally {
      setUploading(false);
    }
  };

  const formatModelName = (modelPath: string | null) => {
    if (!modelPath) return 'Cargando...';
    const model = modelPath.split('/').pop() || '';
    const MODEL_NAMES: Record<string, string> = {
      'gpt-4o': 'GPT-4o (OpenAI)',
      'gpt-4o-mini': 'GPT-4o Mini (OpenAI)',
      'deepseek-chat': 'DeepSeek V3',
      'deepseek-reasoner': 'DeepSeek R1',
      'gemini-3.5-flash': 'Gemini 3.5 Flash',
      'gemini-3-flash': 'Gemini 3 Flash',
      'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
      'llama-3.3-70b-versatile': 'Llama 3.3 70B (Groq)',
      'llama-3.1-8b-instant': 'Llama 3.1 8B (Groq)',
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
      'MiniMax-Text-01': 'MiniMax Text-01',
      'MiniMax-M1': 'MiniMax M1',
      'none': 'Sin traducción (Mismo idioma)',
    };
    return MODEL_NAMES[model] || model;
  };

  const progressPercent = chunkCount > 0 ? Math.round((completedChunks / chunkCount) * 100) : 0;

  const handleReset = () => {
    stopPolling();
    setStep('upload');
    setFile(null);
    setSourceLang('auto');
    setDetectedLang(null);
    setTranslationId(null);
    setStatus('');
    setChunkCount(0);
    setCompletedChunks(0);
    setTranslatedContent(null);
    setErrorMessage(null);
    setMsg('');
    setModelUsed(null);
    fetchHistory();
  };

  const downloadDocx = async () => {
    if (!translationId) return;
    try {
      const res = await api.get(`/document-translation/${translationId}/docx`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `traduccion_${translationId.substring(0, 8)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg('Error al descargar DOCX');
    }
  };

  const downloadPdf = async () => {
    if (!translationId) return;
    try {
      const res = await api.get(`/document-translation/${translationId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `traduccion_${translationId.substring(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg('Error al descargar PDF');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Traductor de Documentos</h1>
      <p className="text-sm text-gray-500 mb-6">Sube un documento Word o PDF para traducirlo a otro idioma</p>

      {msg && (
        <div className={`p-3 rounded-lg mb-6 text-sm ${
          msg.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {msg}
        </div>
      )}

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <form onSubmit={handleUpload} className="bg-white rounded-xl border p-6 space-y-5 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Archivo</label>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer">
              {file ? (
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Arrastra o haz clic para subir</p>
                  <p className="text-xs text-gray-400 mt-1">Word (.docx) o PDF — Máx. 50MB</p>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={e => {
                  setFile(e.target.files?.[0] || null);
                  setSourceLang('auto');
                  setDetectedLang(null);
                }}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Idioma de origen
                <span className="text-xs text-gray-400 ml-1">(déjalo en Auto para detectar)</span>
              </label>
              <select
                value={sourceLang}
                onChange={e => setSourceLang(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm"
              >
                <option value="auto">Detectar automáticamente</option>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Idioma destino</label>
              <select
                value={targetLang}
                onChange={e => setTargetLang(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading || !file || targetLang === sourceLang}
            className="w-full py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
            ) : (
              <><Languages className="w-4 h-4" /> Traducir Documento</>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: Translating (Consolidated Progress) */}
      {step === 'translate' && (
        <div className="bg-white rounded-xl border p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            <span className="text-sm font-medium text-gray-700">
              {STATUS_LABELS[status] || 'Traduciendo documento...'}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-700 flex justify-between">
              <span className="text-gray-500">Archivo:</span>
              <strong className="text-gray-800 truncate max-w-[200px]" title={file?.name || 'Documento'}>
                {file?.name || 'Documento'}
              </strong>
            </p>
            <p className="text-sm text-gray-700 flex justify-between">
              <span className="text-gray-500">Idiomas:</span>
              <strong className="text-gray-800">
                {LANGUAGES.find(l => l.code === (detectedLang || sourceLang))?.name || 'Detectando origen'} →{' '}
                {LANGUAGES.find(l => l.code === targetLang)?.name}
              </strong>
            </p>
            <p className="text-sm text-gray-700 flex justify-between">
              <span className="text-gray-500">Modelo IA:</span>
              <strong className="text-gray-800">
                {formatModelName(modelUsed)}
              </strong>
            </p>
            {detectedLang && sourceLang === 'auto' && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-150 rounded px-2.5 py-1.5 mt-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <span>Idioma detectado: <strong>{LANGUAGES.find(l => l.code === detectedLang)?.name || detectedLang}</strong></span>
              </div>
            )}
          </div>

          {status === 'TRANSLATING' && chunkCount > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-gray-500 font-medium">
                <span>Traducido: {completedChunks} de {chunkCount} bloques</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-150 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              La traducción se ejecuta de manera asíncrona en el servidor. Puedes salir de esta pantalla o cerrar la aplicación; el trabajo continuará procesándose y estará disponible en tu historial.
            </p>
            <button
              onClick={handleReset}
              className="mt-2 w-full py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
            >
              Volver al Inicio / Ver Historial
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Result */}
      {step === 'result' && (
        <div className="space-y-4">
          {status === 'COMPLETED' && translatedContent ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Traducción completada</p>
                  <p className="text-xs text-green-600">
                    {LANGUAGES.find(l => l.code === (detectedLang || sourceLang))?.name || 'Origen'} →{' '}
                    {LANGUAGES.find(l => l.code === targetLang)?.name || 'Destino'}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Texto traducido</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadDocx}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> DOCX
                    </button>
                    <button
                      onClick={downloadPdf}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {translatedContent.substring(0, 5000)}
                    {translatedContent.length > 5000 && (
                      <span className="text-gray-400">... (texto truncado en vista previa)</span>
                    )}
                  </pre>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
                >
                  Nueva traducción
                </button>
              </div>
            </>
          ) : status === 'FAILED' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800">Error en la traducción</p>
              </div>
              <p className="text-sm text-red-600 ml-8 mb-4">{errorMessage || 'Ocurrió un error inesperado'}</p>
              <div className="flex gap-3 ml-8">
                <button
                  onClick={handleRetry}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Reintentando...</>
                  ) : (
                    'Reintentar traducción'
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
                >
                  Nueva traducción / Subir otro
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* History section */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border p-6 space-y-4 shadow-sm mt-6">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Historial de Traducciones</h2>
            </div>
            {historyLoading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          </div>

          {history.length === 0 && !historyLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-xs text-gray-500">No tienes traducciones anteriores</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Tus traducciones se guardan automáticamente</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {history.map((item: any) => {
                const isProcessing = ['PENDING', 'DETECTING_LANG', 'TRANSLATING'].includes(item.status);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                      translationId === item.id
                        ? 'bg-primary-50/50 border-primary-200'
                        : 'bg-gray-50/40 border-gray-150 hover:bg-gray-50 hover:border-gray-250'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.status === 'FAILED' ? 'bg-red-50' : 'bg-primary-50'
                    }`}>
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                      ) : item.status === 'FAILED' ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <FileText className="w-4 h-4 text-primary-600" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-800 truncate" title={item.originalFileName}>
                          {item.originalFileName}
                        </p>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500 border border-gray-200">
                          {item.fileType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 font-medium">
                          {LANGUAGES.find(l => l.code === item.sourceLang)?.name || item.sourceLang} →{' '}
                          {LANGUAGES.find(l => l.code === item.targetLang)?.name}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(item.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isProcessing && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="text-[10px] text-primary-600 font-semibold animate-pulse">
                              {STATUS_LABELS[item.status] || 'Procesando'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => viewHistoryItem(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isProcessing
                          ? 'text-primary-700 bg-primary-50 hover:bg-primary-100'
                          : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {isProcessing ? 'Monitorear' : 'Ver'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
