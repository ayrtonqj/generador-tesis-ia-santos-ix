'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, CheckCircle2, Loader2, Lock, Copy, Download, AlertTriangle, Cpu, Zap, Brain, ChevronDown, FileText, Clock, Trash2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

const PROVIDER_META: Record<string, { name: string; icon: any; color: string; bg: string }> = {
  default: { name: 'Modelo por Defecto', icon: Sparkles, color: 'text-primary-600', bg: 'bg-primary-50' },
  openai: { name: 'OpenAI GPT-4o', icon: Sparkles, color: 'text-green-600', bg: 'bg-green-50' },
  deepseek: { name: 'DeepSeek V3', icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
  gemini: { name: 'Gemini 3.1 Flash Lite', icon: Cpu, color: 'text-purple-600', bg: 'bg-purple-50' },
  groq: { name: 'Groq Llama 3', icon: Cpu, color: 'text-orange-600', bg: 'bg-orange-50' },
  claude: { name: 'Claude 3.5 Sonnet', icon: Brain, color: 'text-amber-600', bg: 'bg-amber-50' },
  minimax: { name: 'MiniMax Text-01', icon: Zap, color: 'text-pink-600', bg: 'bg-pink-50' },
};

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  groq: 'Groq',
  claude: 'Claude',
  minimax: 'MiniMax',
};

const MODEL_NAMES: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'deepseek-chat': 'DeepSeek V3',
  'deepseek-reasoner': 'DeepSeek R1',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3-flash': 'Gemini 3 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-opus-20240229': 'Claude 3 Opus',
  'MiniMax-Text-01': 'MiniMax Text-01',
  'MiniMax-M1': 'MiniMax M1',
};

function markdownToHtml(md: string): string {
  let html = md
    .replace(/^#### (.+)$/gm, '<h5 class="text-sm font-semibold text-primary-600 mt-3 mb-1.5">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold text-primary-700 mt-4 mb-2">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-lg font-bold text-gray-900 mt-5 mb-2 border-b border-gray-100 pb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-6 mb-3 border-b border-gray-200 pb-1.5">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-gray-600 italic">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="text-gray-700 ml-4 list-disc mb-1">$1</li>')
    .replace(/^\* (.+)$/gm, '<li class="text-gray-700 ml-4 list-disc mb-1">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="text-gray-700 ml-4 list-decimal mb-1">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-primary-700 underline transition-colors">$1</a>')
    .replace(/\n\n/g, '</p><p class="text-gray-700 leading-relaxed mb-3">');
  return `<p class="text-gray-700 leading-relaxed mb-3">${html}</p>`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ThesisGeneratorPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [availableProviders, setAvailableProviders] = useState<Record<string, boolean>>({});
  const [selectedProvider, setSelectedProvider] = useState('default');
  const [systemSettings, setSystemSettings] = useState<{ aiProvider: string; aiModel: string } | null>(null);
  const [targetPageRange, setTargetPageRange] = useState('40-50');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [result, setResult] = useState<{ id: string; content: string; sections: string[]; topic?: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/thesis-generator/history');
      setHistory(res.data);
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/templates'),
      api.get('/settings/providers'),
      api.get('/settings').catch(() => null),
      fetchHistory(),
    ]).then(([tRes, pRes, sRes]) => {
      setTemplates(tRes.data);
      setAvailableProviders(pRes.data);
      if (sRes && sRes.data) {
        setSystemSettings({
          aiProvider: sRes.data.aiProvider,
          aiModel: sRes.data.aiModel,
        });
      }
      setSelectedProvider('default');
    }).catch(() => {}).finally(() => setLoading(false));
  }, [fetchHistory]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setSections([]);
      setSelectedSections(new Set());
      return;
    }
    api.get(`/thesis-generator/templates/${selectedTemplateId}/sections`)
      .then((r) => {
        const secs = r.data.sections || [];
        setSections(secs);
        setSelectedSections(new Set(secs.filter((s: any) => s.required).map((s: any) => s.name)));
      })
      .catch(() => setSections([]));
  }, [selectedTemplateId]);

  const toggleSection = (name: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelectedSections(new Set(sections.map((s) => s.name)));
  const deselectAll = () => setSelectedSections(new Set());

  const handleGenerate = async () => {
    if (!selectedTemplateId) { setError('Selecciona un documento patrón'); return; }
    if (!topic.trim()) { setError('Ingresa el tema de la tesis'); return; }
    if (selectedSections.size === 0) { setError('Selecciona al menos una sección'); return; }

    setGenerating(true);
    setError('');
    setResult(null);
    setViewingHistoryId(null);

    try {
      const res = await api.post('/thesis-generator/generate', {
        templateId: selectedTemplateId,
        topic: topic.trim(),
        userPrompt: userPrompt.trim() || undefined,
        sectionNames: Array.from(selectedSections),
        aiProvider: selectedProvider,
        targetPageRange,
      });
      setResult({ ...res.data, topic: topic.trim() });
      fetchHistory();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Error al generar contenido');
    } finally {
      setGenerating(false);
    }
  };

  const viewHistoryItem = async (id: string) => {
    setViewingHistoryId(id);
    setResult(null);
    setError('');
    try {
      const res = await api.get(`/thesis-generator/history/${id}`);
      setResult({ id: res.data.id, content: res.data.content, sections: res.data.sectionNames, topic: res.data.topic });
    } catch (err: any) {
      setError('Error al cargar la generación');
      setViewingHistoryId(null);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    const ok = window.confirm('¿Estás seguro de que deseas eliminar esta generación de tesis del historial? Esta acción no se puede deshacer.');
    if (!ok) return;
    try {
      await api.delete(`/thesis-generator/history/${id}`);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (result?.id === id) setResult(null);
    } catch {}
  };

  const copyMarkdown = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([result.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tesis-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!result) return;
    setDownloadingPdf(true);
    setError('');
    try {
      const res = await api.get(`/thesis-generator/history/${result.id}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTopic = (result.topic || 'documento').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().slice(0, 30).replace(/\s+/g, '_');
      a.download = `tesis-${safeTopic}-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al descargar el PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadDocx = async () => {
    if (!result) return;
    setDownloadingDocx(true);
    setError('');
    try {
      const res = await api.get(`/thesis-generator/history/${result.id}/docx`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTopic = (result.topic || 'documento').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().slice(0, 30).replace(/\s+/g, '_');
      a.download = `tesis-${safeTopic}-${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al descargar el DOCX');
    } finally {
      setDownloadingDocx(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-800">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Generador de Informes de Tesis</h1>
            <p className="text-sm text-gray-500">Genera contenido académico usando IA basado en un documento patrón</p>
          </div>
        </div>

        {/* Template Selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Documento Patrón</label>
          <div className="relative">
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-800 appearance-none cursor-pointer focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow"
            >
              <option value="">Seleccionar template...</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} v{t.version}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Topic */}
        {selectedTemplateId && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tema de la Tesis</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Sistema de recomendación basado en IA para optimizar procesos logísticos..."
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow"
            />
          </div>
        )}

        {/* Sections */}
        {selectedTemplateId && sections.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Secciones a Generar</label>
              <div className="flex gap-3">
                <button onClick={selectAll} className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors">Seleccionar todas</button>
                <button onClick={deselectAll} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Deseleccionar todas</button>
              </div>
            </div>
            <div className="space-y-1.5">
              {sections.map((sec: any) => {
                const checked = selectedSections.has(sec.name);
                return (
                  <label
                    key={sec.name}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      checked ? 'bg-primary-50/50 border border-primary-300' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSection(sec.name)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-white"
                    />
                    <span className="flex-1 text-sm text-gray-700">{sec.name}</span>
                    <div className="flex items-center gap-2">
                      {sec.required && <span className="text-[10px] text-primary-600 font-medium">Requerido</span>}
                      {sec.estimatedWords && <span className="text-[10px] text-gray-400">~{sec.estimatedWords} palabras</span>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Prompt */}
        {selectedTemplateId && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Personalizado <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Ej: Enfócate en el análisis cuantitativo utilizando datos estadísticos. Prioriza la fundamentación teórica con autores clásicos."
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow resize-none"
            />
          </div>
        )}

        {/* Provider Selector */}
        {selectedTemplateId && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-700 mb-3">Proveedor IA</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(PROVIDER_META).map(([id, meta]) => {
                const isAvailable = id === 'default' ? true : availableProviders[id] === true;
                const isSelected = selectedProvider === id;
                const Icon = meta.icon;
                return (
                  <label
                    key={id}
                    title={id !== 'default' && !isAvailable ? `Agrega ${id.toUpperCase()}_API_KEY en el archivo .env para activarlo` : ''}
                    className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      !isAvailable
                        ? 'border-gray-100 bg-gray-50/50 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'border-primary-500 bg-primary-50/30 shadow-sm cursor-pointer'
                        : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="aiProvider"
                      value={id}
                      checked={isSelected}
                      disabled={!isAvailable}
                      onChange={() => setSelectedProvider(id)}
                      className="sr-only"
                    />
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-primary-100 text-primary-600' : `${meta.bg} ${meta.color}`
                    }`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-gray-900 truncate">{meta.name}</p>
                      {id === 'default' ? (
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <div className="flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-primary-600 animate-pulse" />
                            <span className="text-[10px] text-primary-600 font-semibold">Ajustes del Sistema</span>
                          </div>
                          {systemSettings && (
                            <span className="text-[9px] text-gray-400 font-normal truncate block">
                              Activo: {PROVIDER_NAMES[systemSettings.aiProvider] || systemSettings.aiProvider} ({MODEL_NAMES[systemSettings.aiModel] || systemSettings.aiModel})
                            </span>
                          )}
                        </div>
                      ) : isAvailable ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          <span className="text-[10px] text-green-600 font-medium">API Key configurada</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Lock className="w-2.5 h-2.5 text-gray-400" />
                          <span className="text-[10px] text-gray-400">Sin API Key</span>
                        </div>
                      )}
                    </div>
                    {isSelected && isAvailable && (
                      <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Page Range Selector */}
        {selectedTemplateId && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rango de páginas objetivo</label>
            <div className="relative">
              <select
                value={targetPageRange}
                onChange={(e) => setTargetPageRange(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-800 appearance-none cursor-pointer focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow"
              >
                <option value="menos-10">Menos de 10 páginas (muy breve)</option>
                <option value="10-20">10-20 páginas (resumen ejecutivo)</option>
                <option value="20-30">20-30 páginas (resumen)</option>
                <option value="30-40">30-40 páginas</option>
                <option value="40-50">40-50 páginas (recomendado)</option>
                <option value="50-60">50-60 páginas</option>
                <option value="60-70">60-70 páginas</option>
                <option value="70-80">70-80 páginas</option>
                <option value="+80">+80 páginas (extenso)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="mt-2 text-xs text-gray-500">Ajusta la extensión del contenido generado según tus necesidades. Se aplica un factor de escala a las palabras objetivo de cada sección.</p>
          </div>
        )}

        {/* Generate Button */}
        {selectedTemplateId && (
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim() || selectedSections.size === 0}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
              generating
                ? 'bg-primary-600/50 text-white/70 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md active:scale-95 active:shadow-sm'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generando contenido...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generar Informe</>
            )}
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Resultado</h2>
              <div className="flex gap-2">
                <button
                  onClick={copyMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200/85 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copiado' : 'Copiar Markdown'}
                </button>
                <button
                  onClick={downloadMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200/85 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar .md
                </button>
                <button
                  onClick={downloadDocx}
                  disabled={downloadingDocx}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 transition-all shadow-sm active:scale-95"
                >
                  {downloadingDocx ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {downloadingDocx ? 'Convirtiendo...' : 'Descargar DOCX'}
                </button>
                <button
                  onClick={downloadPdf}
                  disabled={downloadingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed bg-primary-600 hover:bg-primary-700 transition-all shadow-sm active:scale-95"
                >
                  {downloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {downloadingPdf ? 'Convirtiendo...' : 'Descargar PDF'}
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto bg-gray-50/40">
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: markdownToHtml(result.content) }} />
            </div>
          </div>
        )}

        {/* History */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Historial de Generaciones</h2>
            </div>
            {historyLoading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          </div>

          {history.length === 0 && !historyLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-xs text-gray-500">No tienes generaciones anteriores</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Las generaciones se guardan automáticamente al crearlas</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="space-y-2">
              {history.map((item: any) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    viewingHistoryId === item.id
                      ? 'bg-primary-50/50 border-primary-200'
                      : 'bg-gray-50/40 border-gray-150 hover:bg-gray-50 hover:border-gray-250'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.status === 'FAILED' ? 'bg-red-50' : 'bg-primary-50'
                  }`}>
                    {item.status === 'FAILED' ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.topic}</p>
                      {item.status === 'FAILED' && <span className="text-[10px] text-red-500 font-semibold">Error</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{formatDate(item.createdAt)}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span className="text-[10px] text-gray-400">{PROVIDER_NAMES[item.aiProvider] || item.aiProvider}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span className="text-[10px] text-gray-400">{item.sectionNames?.length || 0} secciones</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => viewHistoryItem(item.id)}
                      className="px-2.5 py-1 rounded-md text-[10px] font-semibold text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 transition-all animate-none"
                    >
                      Ver
                    </button>
                    <button
                      onClick={() => deleteHistoryItem(item.id)}
                      className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Empty state */}
        {!selectedTemplateId && history.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Selecciona un documento patrón para empezar</p>
            <p className="text-xs text-gray-400 mt-1">Luego podrás elegir secciones, ingresar el tema y generar contenido académico con IA</p>
          </div>
        )}
      </div>
    </div>
  );
}
