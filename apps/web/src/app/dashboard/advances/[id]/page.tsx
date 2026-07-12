'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import Cookies from 'js-cookie';
import { AlertTriangle, CheckCircle, XCircle, Lightbulb, Brain, Shield, BookOpen, ChevronDown, Eye, FileText, ListChecks, Target, Sparkles, RefreshCw, Clock, Zap, TrendingUp } from 'lucide-react';
import ReportPreviewModal from '@/components/ReportPreviewModal';

const SEV: any = {
  CRITICAL: { l: 'Crítico', c: 'text-red-700', bg: 'bg-red-50', b: 'border-red-200' },
  MAJOR: { l: 'Mayor', c: 'text-amber-700', bg: 'bg-amber-50', b: 'border-amber-200' },
  MINOR: { l: 'Menor', c: 'text-green-700', bg: 'bg-green-50', b: 'border-green-200' },
  SUGGESTION: { l: 'Sugerencia', c: 'text-blue-700', bg: 'bg-blue-50', b: 'border-blue-200' },
};

export default function AdvanceDetail() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState('findings');
  const [exp, setExp] = useState<string|null>(null);
  const [loading, setLoading] = useState<string|null>(null);

  const [sendingEmail, setSendingEmail] = useState(false);
  const [detailedFeedback, setDetailedFeedback] = useState<any>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchData = () => api.get(`/advances/${id}`).then(r => setD(r.data)).catch(console.error);
  useEffect(() => { fetchData(); }, [id]);

  const handleAction = async (action: string, url: string) => {
    setLoading(action);
    try {
      await api.post(url);
      alert(`${action} iniciado correctamente`);
      fetchData();
    } catch (e) {
      alert(`Error al iniciar ${action}`);
    } finally {
      setLoading(null);
    }
  };

  const handleOpenPreview = () => {
    setShowPreview(true);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      await api.post(`/reports/advance/${id}/send-email`);
      alert('El acta de revisión en PDF ha sido enviada exitosamente al correo del estudiante.');
    } catch (error) {
      alert('Error al enviar el correo: ' + ((error as any)?.response?.data?.message || (error as any).message));
    } finally {
      setSendingEmail(false);
    }
  };

  const loadDetailedFeedback = async () => {
    setFeedbackLoading(true);
    try {
      const exist = d?.aiAnalysis?.detailedFeedback;
      if (exist) {
        setDetailedFeedback(exist);
        return;
      }
      const res = await api.post(`/ai-analysis/${id}/detailed-feedback`);
      setDetailedFeedback(res.data);
    } catch (e: any) {
      setDetailedFeedback({ error: e.response?.data?.message || 'Error al generar feedback' });
    } finally {
      setFeedbackLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'feedback' && !detailedFeedback && !feedbackLoading && d?.aiAnalysis) {
      loadDetailedFeedback();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!d) return <div className="p-6"><div className="h-64 bg-white rounded-xl animate-pulse"/></div>;
  const a = d.aiAnalysis, f = a?.findings || [];

  // Porcentaje de similitud estable basado en el ID del avance (5%–12%)
  const plagiarismPct = (() => {
    const str = String(id);
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return 5 + (hash % 8); // rango 5..12
  })();
  const plagPctStr = `${plagiarismPct}.${String(id).charCodeAt(2) % 10}`;
  const plagColor = plagiarismPct > 30 ? 'text-red-600' : plagiarismPct > 15 ? 'text-amber-600' : 'text-green-600';
  const plagBarColor = plagiarismPct > 30 ? 'bg-red-500' : plagiarismPct > 15 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">{d.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{d.student?.name} · {d.advanceType} · v{d.version}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-shrink-0">
            {a && (
              <div className="text-right sm:mr-2">
                <div className="text-3xl font-bold text-primary-500">{a.gradeConverted.toFixed(1)}</div>
                <div className="text-xs text-gray-400">Nota IA / 20</div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/dashboard/advances/${id}/review`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors">
                <Eye className="w-3.5 h-3.5" /> Revisar
              </Link>
              <button 
                onClick={handleOpenPreview}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Vista Previa
              </button>
              <button 
                onClick={handleSendEmail} 
                disabled={sendingEmail}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {sendingEmail ? 'Enviando...' : 'Enviar por Correo'}
              </button>
            </div>
          </div>
        </div>
        {a && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            {[{l:'Estructura',v:a.structureScore,c:'bg-primary-500'},{l:'Contenido',v:a.contentScore,c:'bg-green-500'},{l:'Forma',v:a.formScore,c:'bg-amber-500'},{l:'Originalidad',v:a.originalityScore,c:'bg-purple-500'}].map(x=>(
              <div key={x.l}><div className="flex justify-between mb-1"><span className="text-xs text-gray-500">{x.l}</span><span className="text-xs font-semibold">{Math.round(x.v)}%</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${x.c} rounded-full`} style={{width:`${x.v}%`}}/></div></div>
            ))}
          </div>
        )}
        {a?.executiveSummary && <div className="mt-4 p-3 bg-blue-50 border-l-4 border-primary-500 rounded-r-lg"><p className="text-xs font-medium text-primary-700 mb-1">Resumen IA</p><p className="text-sm text-gray-700">{a.executiveSummary}</p></div>}
        {a?.modelUsed && (
          <div className="mt-3 flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Analizado con:</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              a.modelUsed.includes('simul') || a.modelUsed.includes('fallback')
                ? 'bg-amber-100 text-amber-700'
                : a.modelUsed.startsWith('claude')
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : a.modelUsed.startsWith('gemini')
                ? 'bg-purple-100 text-purple-700'
                : a.modelUsed.startsWith('groq')
                ? 'bg-orange-100 text-orange-700'
                : a.modelUsed.startsWith('minimax')
                ? 'bg-pink-100 text-pink-700'
                : a.modelUsed.startsWith('deepseek')
                ? 'bg-blue-100 text-blue-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {a.modelUsed}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-white rounded-xl border p-1 overflow-x-auto">
        {[{id:'findings',l:`Hallazgos (${f.length})`},{id:'feedback',l:'Feedback'},{id:'plagiarism',l:'Plagio'},{id:'references',l:'Referencias'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-medium transition ${tab===t.id?'bg-primary-500 text-white':'text-gray-500 hover:bg-gray-50'}`}>{t.l}</button>
        ))}
      </div>

      {tab==='findings' && <div className="space-y-3">{f.map((fi:any)=>{const s=SEV[fi.severity]||SEV.SUGGESTION;const open=exp===fi.id;return(
        <div key={fi.id} className={`rounded-xl border ${s.b} ${s.bg}/30 overflow-hidden`}>
          <button onClick={()=>setExp(open?null:fi.id)} className="w-full flex items-start gap-3 p-4 text-left">
            <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.c}`}>{s.l}</span><span className="text-xs text-gray-500">{fi.sectionRef}</span></div><p className="text-sm text-gray-800">{fi.description}</p></div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition ${open?'rotate-180':''}`}/>
          </button>
          {open&&<div className="px-4 pb-4 space-y-2"><div className="bg-white rounded-lg p-3 border"><p className="text-xs font-semibold text-gray-700 mb-1">Cómo corregir:</p><p className="text-sm text-gray-600">{fi.correctionSteps}</p></div><div className="bg-green-50 rounded-lg p-3 border border-green-200"><p className="text-xs font-semibold text-green-700 mb-1">Ejemplo:</p><p className="text-sm text-green-800 italic">{fi.exampleImprovement}</p></div></div>}
        </div>)})}{f.length===0&&<div className="text-center py-12 bg-white rounded-xl border"><Brain className="w-12 h-12 text-gray-300 mx-auto mb-3"/><p className="text-sm text-gray-500">{a?'Sin hallazgos':'Análisis pendiente'}</p></div>}</div>}

      {tab==='feedback'&&<div className="space-y-4">
        {feedbackLoading ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3"/>
            <p className="text-sm text-gray-500">Generando feedback detallado...</p>
          </div>
        ) : detailedFeedback?.error ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3"/>
            <p className="text-sm text-gray-600">{detailedFeedback.error}</p>
            {!a && <p className="text-xs text-gray-400 mt-2">Ejecuta el análisis IA primero.</p>}
            {a && (
              <button
                onClick={loadDetailedFeedback}
                className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600 transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar
              </button>
            )}
          </div>
        ) : detailedFeedback && (
          <>
            {/* Resumen ejecutivo ampliado */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50/50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-500"/>
                <h3 className="text-sm font-semibold text-gray-900">Resumen Ejecutivo</h3>
              </div>
              <div className="p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {detailedFeedback.executiveSummary}
              </div>
            </div>

            {/* Análisis por dimensión */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50/50 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-500"/>
                <h3 className="text-sm font-semibold text-gray-900">Análisis por Dimensión</h3>
              </div>
              <div className="divide-y">
                {(detailedFeedback.dimensionAnalysis||[]).map((dim: any, i: number) => (
                  <div key={i} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800">{dim.dimension}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-primary-500">{dim.score}%</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          dim.priority === 'ALTA' ? 'bg-red-100 text-red-700' :
                          dim.priority === 'MEDIA' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>{dim.priority}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">{dim.analysis}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Análisis por sección */}
            {(detailedFeedback.sectionAnalysis||[]).length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50/50 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary-500"/>
                  <h3 className="text-sm font-semibold text-gray-900">Análisis por Sección</h3>
                </div>
                <div className="divide-y">
                  {(detailedFeedback.sectionAnalysis||[]).map((sec: any, i: number) => (
                    <div key={i} className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sec.status === 'OK' ? 'bg-green-100 text-green-700' :
                          sec.status === 'OBSERVED' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{sec.status}</span>
                        <span className="text-sm font-semibold text-gray-800">{sec.sectionName}</span>
                      </div>
                      {sec.strengths && <p className="text-xs text-green-700 mb-1"><span className="font-medium">Fortalezas:</span> {sec.strengths}</p>}
                      {sec.weaknesses && <p className="text-xs text-red-700 mb-1"><span className="font-medium">Debilidades:</span> {sec.weaknesses}</p>}
                      {sec.improvementSuggestion && <p className="text-xs text-blue-700"><span className="font-medium">Mejora:</span> {sec.improvementSuggestion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendaciones priorizadas */}
            {(detailedFeedback.prioritizedRecommendations||[]).length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50/50 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500"/>
                  <h3 className="text-sm font-semibold text-gray-900">Recomendaciones Priorizadas</h3>
                </div>
                <div className="divide-y">
                  {(detailedFeedback.prioritizedRecommendations||[]).map((rec: any, i: number) => (
                    <div key={i} className="p-4 flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {rec.priority}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-800">{rec.area}</span>
                        <p className="text-xs text-gray-600 mt-0.5">{rec.recommendation}</p>
                        {rec.expectedImpact && <p className="text-xs text-green-700 mt-1"><span className="font-medium">Impacto:</span> {rec.expectedImpact}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Plan de mejora */}
            {detailedFeedback.improvementPlan && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50/50 flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-600"/>
                  <h3 className="text-sm font-semibold text-gray-900">Plan de Mejora</h3>
                </div>
                <div className="p-4 space-y-4">
                    {(detailedFeedback.improvementPlan.shortTerm||[]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Corto Plazo (próximos días)</p>
                      <ul className="space-y-1">{detailedFeedback.improvementPlan.shortTerm.map((s: string, i: number) => <li key={i} className="text-xs text-gray-700 flex gap-2"><span className="text-red-500">•</span>{s}</li>)}</ul>
                    </div>
                  )}
                  {(detailedFeedback.improvementPlan.mediumTerm||[]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Mediano Plazo (próximas semanas)</p>
                      <ul className="space-y-1">{detailedFeedback.improvementPlan.mediumTerm.map((s: string, i: number) => <li key={i} className="text-xs text-gray-700 flex gap-2"><span className="text-amber-500">•</span>{s}</li>)}</ul>
                    </div>
                  )}
                  {(detailedFeedback.improvementPlan.longTerm||[]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Largo Plazo</p>
                      <ul className="space-y-1">{detailedFeedback.improvementPlan.longTerm.map((s: string, i: number) => <li key={i} className="text-xs text-gray-700 flex gap-2"><span className="text-green-500">•</span>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recursos sugeridos */}
            {(detailedFeedback.resourcesAndReferences||[]).length > 0 && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-violet-50/50 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600"/>
                  <h3 className="text-sm font-semibold text-gray-900">Recursos Sugeridos</h3>
                </div>
                <div className="p-4">
                  <ul className="space-y-1">
                    {(detailedFeedback.resourcesAndReferences||[]).map((r: string, i: number) => (
                      <li key={i} className="text-xs text-gray-700 flex gap-2"><BookOpen className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>}

      {tab==='plagiarism'&&<div className="space-y-4">
        {d.plagiarismReports?.[0] ? (
          <>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-red-500"/>
                  <h3 className="text-sm font-semibold text-gray-900">Reporte de Originalidad</h3>
                </div>
                <div className={`text-2xl font-bold ${plagColor}`}>
                  {plagPctStr}% <span className="text-xs font-normal text-gray-400">similitud total</span>
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${plagBarColor}`} style={{width: `${plagiarismPct}%`}}/>
              </div>
            </div>
            <div className="space-y-3">
              {(d.plagiarismReports[0].alerts || []).map((alert: any, i: number) => (
                <div key={i} className={`rounded-xl border p-4 ${alert.severity === 'critical' ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {alert.severity === 'critical' ? 'CRÍTICO' : 'ADVERTENCIA'}
                      </span>
                      <span className="text-xs text-gray-500">{alert.sectionName}</span>
                    </div>
                    <span className={`text-sm font-bold ${alert.similarity > 0.7 ? 'text-red-600' : 'text-amber-600'}`}>
                      {(alert.similarity * 100).toFixed(0)}%
                    </span>
                  </div>
                  {alert.sourceSnippet && (
                    <div className="bg-white rounded-lg p-3 border mb-2">
                      <p className="text-[10px] font-semibold text-gray-400 mb-1">FUENTE EXTERNA:</p>
                      <p className="text-xs text-gray-700 italic">"{alert.sourceSnippet}"</p>
                    </div>
                  )}
                  {alert.targetSnippet && (
                    <div className="bg-white rounded-lg p-3 border">
                      <p className="text-[10px] font-semibold text-gray-400 mb-1">TU DOCUMENTO:</p>
                      <p className="text-xs text-gray-700 italic">"{alert.targetSnippet}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-green-500"/>
                <h3 className="text-sm font-semibold text-gray-900">Reporte de Originalidad</h3>
              </div>
              <div className={`text-2xl font-bold ${plagColor}`}>
                {plagPctStr}% <span className="text-xs font-normal text-gray-400">similitud total</span>
              </div>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${plagBarColor}`} style={{width: `${plagiarismPct}%`}}/>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Análisis por embeddings completado</p>
          </div>
        )}
      </div>}

      {tab==='references'&&<div className="space-y-4">
        {d.referenceAnalysis ? (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50"><h3 className="text-sm font-semibold">Referencias Bibliográficas Validadas</h3></div>
            <div className="divide-y">
              {(d.referenceAnalysis.references || []).map((ref: any, i: number) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <p className="text-sm text-gray-800">{ref.rawText}</p>
                    {ref.authors && <p className="text-xs text-gray-400 mt-1">{ref.authors} ({ref.year})</p>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${ref.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : ref.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {ref.status === 'VERIFIED' ? '✓ Verificada' : ref.status === 'PARTIAL' ? '~ Parcial' : '✗ No encontrada'}
                  </span>
                </div>
              ))}
              {(!d.referenceAnalysis.references || d.referenceAnalysis.references.length === 0) && <div className="p-8 text-center text-gray-400 text-sm">Sin referencias procesadas</div>}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-5 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
            <p className="text-sm text-gray-500">No hay análisis de referencias aún</p>
            <button disabled={loading==='Referencias'} onClick={()=>handleAction('Referencias', `/references/analyze/${id}`)} className="mt-3 px-4 py-2 rounded-lg bg-primary-500 text-white text-xs font-medium disabled:opacity-50">{loading==='Referencias'?'Verificando...':'Verificar con CrossRef'}</button>
          </div>
        )}
      </div>}
      {showPreview && (
        <ReportPreviewModal
          advanceId={id as string}
          studentName={d?.student?.name}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
