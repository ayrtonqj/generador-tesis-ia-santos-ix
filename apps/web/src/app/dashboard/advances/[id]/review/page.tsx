'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Cookies from 'js-cookie';
import {
  AlertTriangle, CheckCircle, XCircle, Lightbulb, Brain, Shield, BookOpen,
  ChevronDown, ChevronUp, MessageSquare, Save, ArrowLeft,
  ThumbsUp, ThumbsDown, Edit3, FileText, Loader2, Eye
} from 'lucide-react';
import ReportPreviewModal from '@/components/ReportPreviewModal';

const SEV: any = {
  CRITICAL: { l: 'Crítico', c: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
  MAJOR: { l: 'Mayor', c: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  MINOR: { l: 'Menor', c: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' },
  SUGGESTION: { l: 'Sugerencia', c: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
};

export default function ReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'ai' | 'human'>('ai');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<Record<string, { action: string; comment: string; severity: string; description: string }>>({});
  const [reviewComment, setReviewComment] = useState('');
  const [finalGrade, setFinalGrade] = useState('');
  const [reviewStatus, setReviewStatus] = useState('APPROVED');
  const [saving, setSaving] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const userData = Cookies.get('kimy_user');
    if (userData) { try { setUser(JSON.parse(userData)); } catch {} }
  }, []);

  const fetchData = () => {
    api.get(`/advances/${id}`).then(r => {
      setD(r.data);
      if (r.data.review) {
        setReviewComment(r.data.review.humanComment || '');
        setFinalGrade(r.data.review.finalGrade?.toString() || '');
        setReviewStatus(r.data.review.status || 'APPROVED');
      } else if (r.data.aiAnalysis) {
        setFinalGrade(r.data.aiAnalysis.gradeConverted?.toFixed(1) || '');
      }
    }).catch(console.error);
  };

  useEffect(() => { fetchData(); }, [id]);

  // Fetch preview URL
  useEffect(() => {
    if (id) {
      api.get(`/advances/${id}/preview`).then(r => setPreviewUrl(r.data.url)).catch(() => setPreviewUrl(null));
    }
  }, [id]);

  const handleFindingFeedback = async (findingId: string) => {
    const state = feedbackStates[findingId];
    if (!state?.action) return;
    setFeedbackSaving(findingId);
    try {
      await api.post(`/reviews/findings/${findingId}/feedback`, {
        action: state.action,
        humanComment: state.comment || undefined,
        adjustedSeverity: state.action === 'MODIFIED' ? state.severity : undefined,
        adjustedDescription: state.action === 'MODIFIED' ? state.description : undefined,
      });
      fetchData();
    } catch (e) {
      console.error('Error al guardar feedback:', e);
    } finally {
      setFeedbackSaving(null);
    }
  };

  const handleSaveReview = async () => {
    setSaving(true);
    try {
      await api.post(`/reviews/${id}`, {
        finalGrade: finalGrade ? parseFloat(finalGrade) : undefined,
        humanComment: reviewComment,
        status: reviewStatus,
      });
      alert('Revisión guardada exitosamente');
      fetchData();
    } catch (e: any) {
      alert('Error al guardar: ' + (e?.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = () => {
    setShowPreview(true);
  };

  const handleSendEmail = async () => {
    try {
      alert('Enviando email...');
      const res = await api.post(`/reports/advance/${id}/send-email`);
      alert(res.data?.message || 'Email enviado exitosamente.');
    } catch (e: any) {
      alert('Error al enviar email: ' + (e?.response?.data?.message || e.message));
    }
  };

  const updateFeedback = (findingId: string, key: string, value: string) => {
    setFeedbackStates(prev => ({
      ...prev,
      [findingId]: { ...prev[findingId], [key]: value }
    }));
  };

  if (!d) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 text-primary-500 animate-spin" /></div>;
  const a = d.aiAnalysis;
  const findings = a?.findings || [];
  const isAdvisor = user?.role === 'ADVISOR' || user?.role === 'COORDINATOR' || user?.role === 'ADMIN';

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">{d.title}</h1>
            <p className="text-[11px] text-gray-400">{d.student?.name} · {d.advanceType} · v{d.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {a && (
            <div className="flex items-center gap-2 mr-3">
              <span className="text-xs text-gray-400">IA:</span>
              <span className="text-lg font-bold text-primary-500">{a.gradeConverted?.toFixed(1)}</span>
              <span className="text-xs text-gray-400">/20</span>
            </div>
          )}
          <button onClick={handleSendEmail} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium transition-colors">
            <MessageSquare className="w-3.5 h-3.5" /> Enviar Email
          </button>
          <button onClick={handleOpenPreview} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors">
            <Eye className="w-3.5 h-3.5" /> Vista Previa
          </button>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document Preview */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Vista previa del documento</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full rounded-lg border shadow-sm bg-white" title="Preview" />
            ) : d.extractedText ? (
              <div className="bg-white rounded-lg border shadow-sm p-6 prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans leading-relaxed">{d.extractedText}</pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText className="w-16 h-16 mb-3 opacity-30" />
                <p className="text-sm">Texto no disponible</p>
                <p className="text-xs mt-1">Sube el documento o ejecuta el análisis IA</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Review Panel */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex bg-white border-b border-gray-200 px-4 pt-1">
            <button onClick={() => setTab('ai')} className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === 'ai' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <Brain className="w-3.5 h-3.5 inline mr-1.5" />Evaluación IA ({findings.length})
            </button>
            {isAdvisor && (
              <button onClick={() => setTab('human')} className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === 'human' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />Mi Revisión
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'ai' && (
              <div className="p-4 space-y-3">
                {/* Score Summary */}
                {a && (
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { l: 'Estructura', v: a.structureScore, c: 'text-primary-500' },
                      { l: 'Contenido', v: a.contentScore, c: 'text-green-500' },
                      { l: 'Forma', v: a.formScore, c: 'text-amber-500' },
                      { l: 'Originalidad', v: a.originalityScore, c: 'text-purple-500' },
                    ].map(x => (
                      <div key={x.l} className="bg-white rounded-lg border p-2.5 text-center">
                        <div className={`text-lg font-bold ${x.c}`}>{Math.round(x.v)}%</div>
                        <div className="text-[10px] text-gray-400">{x.l}</div>
                      </div>
                    ))}
                  </div>
                )}

                {a?.executiveSummary && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-[10px] font-bold text-blue-600 mb-1">RESUMEN EJECUTIVO IA</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{a.executiveSummary}</p>
                  </div>
                )}

                {a?.modelUsed && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[10px] text-gray-400">Modelo:</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${a.modelUsed.includes('simulated') || a.modelUsed.includes('fallback') ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {a.modelUsed}
                    </span>
                  </div>
                )}

                {/* Findings */}
                {findings.map((fi: any) => {
                  const s = SEV[fi.severity] || SEV.SUGGESTION;
                  const isOpen = expanded === fi.id;
                  const fb = feedbackStates[fi.id] || {};
                  const alreadyReviewed = fi.humanAction != null;

                  return (
                    <div key={fi.id} className={`rounded-xl border ${s.border} overflow-hidden transition-shadow hover:shadow-sm ${alreadyReviewed ? 'opacity-60' : ''}`}>
                      <button onClick={() => setExpanded(isOpen ? null : fi.id)} className="w-full flex items-start gap-3 p-3.5 text-left">
                        <div className={`w-2 h-2 rounded-full ${s.dot} mt-1.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.c}`}>{s.l}</span>
                            <span className="text-[11px] text-gray-500">{fi.sectionRef}</span>
                            {fi.pageRef && <span className="text-[10px] text-gray-400">p.{fi.pageRef}</span>}
                            {alreadyReviewed && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${fi.humanAction === 'ACCEPTED' ? 'bg-green-100 text-green-700' : fi.humanAction === 'MODIFIED' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                {fi.humanAction === 'ACCEPTED' ? '✓ Aceptado' : fi.humanAction === 'MODIFIED' ? '✎ Modificado' : '✗ Descartado'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-800 leading-relaxed">{fi.description}</p>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </button>

                      {isOpen && (
                        <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-gray-100 pt-3">
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-[10px] font-bold text-gray-500 mb-1">CÓMO CORREGIR</p>
                            <p className="text-xs text-gray-700">{fi.correctionSteps}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <p className="text-[10px] font-bold text-green-600 mb-1">EJEMPLO DE MEJORA</p>
                            <p className="text-xs text-green-800 italic">{fi.exampleImprovement}</p>
                          </div>
                          {fi.recommendation && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <p className="text-[10px] font-bold text-blue-600 mb-1">RECOMENDACIÓN</p>
                              <p className="text-xs text-blue-800">{fi.recommendation}</p>
                            </div>
                          )}

                          {/* Advisor Feedback */}
                          {isAdvisor && !alreadyReviewed && (
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2.5">
                              <p className="text-[10px] font-bold text-gray-500">FEEDBACK DEL ASESOR</p>
                              <div className="flex gap-1.5">
                                {[
                                  { action: 'ACCEPTED', label: 'Aceptar', icon: ThumbsUp, cls: 'bg-green-500 text-white' },
                                  { action: 'MODIFIED', label: 'Modificar', icon: Edit3, cls: 'bg-blue-500 text-white' },
                                  { action: 'REJECTED', label: 'Descartar', icon: ThumbsDown, cls: 'bg-red-500 text-white' },
                                ].map(opt => (
                                  <button
                                    key={opt.action}
                                    onClick={() => updateFeedback(fi.id, 'action', opt.action)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${fb.action === opt.action ? opt.cls : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                  >
                                    <opt.icon className="w-3 h-3" />{opt.label}
                                  </button>
                                ))}
                              </div>
                              {fb.action === 'MODIFIED' && (
                                <div className="space-y-2">
                                  <select
                                    value={fb.severity || fi.severity}
                                    onChange={e => updateFeedback(fi.id, 'severity', e.target.value)}
                                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-300"
                                  >
                                    <option value="CRITICAL">Crítico</option>
                                    <option value="MAJOR">Mayor</option>
                                    <option value="MINOR">Menor</option>
                                    <option value="SUGGESTION">Sugerencia</option>
                                  </select>
                                  <textarea
                                    value={fb.description || fi.description}
                                    onChange={e => updateFeedback(fi.id, 'description', e.target.value)}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 min-h-[60px]"
                                    placeholder="Descripción corregida..."
                                  />
                                </div>
                              )}
                              {(fb.action === 'REJECTED' || fb.action === 'MODIFIED') && (
                                <textarea
                                  value={fb.comment || ''}
                                  onChange={e => updateFeedback(fi.id, 'comment', e.target.value)}
                                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 min-h-[40px]"
                                  placeholder={fb.action === 'REJECTED' ? 'Razón del descarte...' : 'Comentario adicional...'}
                                />
                              )}
                              {fb.action && (
                                <button
                                  onClick={() => handleFindingFeedback(fi.id)}
                                  disabled={feedbackSaving === fi.id}
                                  className="w-full py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                  {feedbackSaving === fi.id ? 'Guardando...' : 'Guardar feedback'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {findings.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Brain className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{a ? 'Sin hallazgos' : 'Análisis IA pendiente'}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'human' && isAdvisor && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nota Final (0-20)</label>
                  <input
                    type="number"
                    min="0" max="20" step="0.1"
                    value={finalGrade}
                    onChange={e => setFinalGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                    placeholder="Ej: 15.5"
                  />
                  {a && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Nota sugerida por IA: {a.gradeConverted?.toFixed(1)} / 20
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Comentario General del Asesor</label>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm min-h-[120px] focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                    placeholder="Observaciones generales sobre el avance..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Decisión</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: 'APPROVED', l: 'Aprobar', c: 'border-green-300 bg-green-50 text-green-700', icon: CheckCircle },
                      { v: 'OBSERVED', l: 'Observar', c: 'border-amber-300 bg-amber-50 text-amber-700', icon: AlertTriangle },
                      { v: 'REJECTED', l: 'Rechazar', c: 'border-red-300 bg-red-50 text-red-700', icon: XCircle },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setReviewStatus(opt.v)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-medium transition-all ${reviewStatus === opt.v ? opt.c : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}`}
                      >
                        <opt.icon className="w-3.5 h-3.5" />{opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSaveReview}
                  disabled={saving}
                  className="w-full py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar Revisión</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
