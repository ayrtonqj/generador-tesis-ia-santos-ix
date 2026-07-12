'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BookTemplate, Upload, FileText, Pencil, ToggleLeft, ToggleRight, Eye, FileDown, X, ExternalLink } from 'lucide-react';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', version: '1.0', programId: '' });
  const [file, setFile] = useState<File | null>(null);
  const [selectedSchemaTemplate, setSelectedSchemaTemplate] = useState<any | null>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'active' | 'inactive' | 'all'>('active');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', version: '' });
  const [confirmToggleTemplate, setConfirmToggleTemplate] = useState<any | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; fileType: string; name: string } | null>(null);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    const includeInactive = filterMode !== 'active';
    Promise.all([
      api.get(`/templates?includeInactive=${includeInactive}`),
      api.get('/programs'),
    ])
      .then(([t, p]) => {
        setTemplates(t.data);
        setPrograms(p.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filterMode]);

  const handleUpload = async (e: any) => {
    e.preventDefault();
    if (!file) {
      alert('Por favor selecciona un archivo PDF o Word.');
      return;
    }
    const data = new FormData();
    data.append('file', file);
    data.append('name', formData.name);
    data.append('version', formData.version);
    data.append('programId', formData.programId);

    try {
      setLoading(true);
      await api.post('/templates/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('Patrón subido exitosamente. La IA está extrayendo su estructura en segundo plano.');
      setShowUploadModal(false);
      fetchData();
    } catch (error: any) {
      alert('Error al subir patrón: ' + (error?.response?.data?.message || error.message));
      setLoading(false);
    }
  };

  const openEdit = (t: any) => {
    setEditingTemplate(t);
    setEditFormData({ name: t.name, version: t.version });
    setShowEditModal(true);
  };

  const handleEdit = async (e: any) => {
    e.preventDefault();
    try {
      await api.put(`/templates/${editingTemplate.id}`, editFormData);
      setShowEditModal(false);
      setEditingTemplate(null);
      fetchData();
    } catch (error: any) {
      alert('Error al editar: ' + (error?.response?.data?.message || error.message));
    }
  };

  const handleToggle = async (t: any) => {
    try {
      await api.patch(`/templates/${t.id}/toggle`);
      setConfirmToggleTemplate(null);
      fetchData();
    } catch (error: any) {
      alert('Error al cambiar estado: ' + (error?.response?.data?.message || error.message));
    }
  };

  const handleViewFile = async (t: any) => {
    try {
      setLoadingFileId(t.id);
      const res = await api.get(`/templates/${t.id}/file-url`);
      const { url, fileType, name } = res.data;
      if (fileType === 'pdf') {
        setViewingFile({ url, fileType, name });
      } else {
        // For Word documents: open in new tab or download
        window.open(url, '_blank');
      }
    } catch (error: any) {
      alert('Error al obtener el archivo: ' + (error?.response?.data?.message || error.message));
    } finally {
      setLoadingFileId(null);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'active') return t.isActive !== false;
    return t.isActive === false;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Documentos Patrón</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona los formatos y rúbricas institucionales</p>
        </div>
        <button onClick={() => setShowUploadModal(true)} className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition flex items-center gap-2">
          <Upload className="w-4 h-4" /> Subir Patrón
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {[
          { key: 'active', label: 'Activos' },
          { key: 'inactive', label: 'Inactivos' },
          { key: 'all', label: 'Todos' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterMode(f.key as any)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterMode === f.key
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="font-semibold text-gray-900">Nuevo Documento Patrón</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Nombre del Formato</label><input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" placeholder="Ej: Formato APA 7mo" /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Programa / Facultad</label>
                <select required value={formData.programId} onChange={e=>setFormData({...formData, programId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="">Seleccionar programa...</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Archivo de Referencia (.pdf/.docx)</label><input type="file" required onChange={e=>setFile(e.target.files?.[0] || null)} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" /></div>
              <button type="submit" className="w-full py-2.5 bg-primary-500 text-white rounded-lg font-semibold text-sm hover:bg-primary-600 transition mt-2">Registrar Patrón</button>
            </form>
          </div>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 bg-white rounded-xl border border-gray-200 animate-pulse" />)
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-gray-200">
            <BookTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {filterMode === 'active' ? 'No hay documentos patrón activos' :
               filterMode === 'inactive' ? 'No hay documentos patrón inactivos' :
               'No hay documentos patrón registrados'}
            </p>
          </div>
        ) : (
          filteredTemplates.map((t) => (
            <div key={t.id} className={`p-5 rounded-xl border transition ${
              t.isActive === false
                ? 'bg-gray-50 border-gray-200 opacity-70'
                : 'bg-white border-gray-200 hover:shadow-md'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  {t.isActive === false && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-[9px] font-bold rounded-full uppercase tracking-wider">
                      Inactivo
                    </span>
                  )}
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full">
                    v{t.version}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 truncate" title={t.name}>{t.name}</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4">{t.program?.name || 'General'}</p>
              
              <div className="flex gap-1.5">
                <button onClick={() => setSelectedSchemaTemplate(t)} className="flex-1 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-50 transition flex items-center justify-center gap-1">
                  <Eye className="w-3 h-3" /> Estructura
                </button>
                <button
                  onClick={() => handleViewFile(t)}
                  disabled={loadingFileId === t.id}
                  className="flex-1 py-1.5 border border-blue-200 text-blue-600 text-xs font-medium rounded-md hover:bg-blue-50 transition flex items-center justify-center gap-1 disabled:opacity-50"
                  title={t.fileType === 'pdf' ? 'Ver PDF' : 'Descargar Word'}
                >
                  {loadingFileId === t.id ? (
                    <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  ) : t.fileType === 'pdf' ? (
                    <><Eye className="w-3 h-3" /> Ver Doc.</>
                  ) : (
                    <><FileDown className="w-3 h-3" /> Descargar</>
                  )}
                </button>
                <button onClick={() => openEdit(t)} className="px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition" title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setConfirmToggleTemplate(t)}
                  className={`px-2.5 py-1.5 border rounded-md transition ${
                    t.isActive === false
                      ? 'border-green-200 text-green-600 hover:bg-green-50'
                      : 'border-orange-200 text-orange-600 hover:bg-orange-50'
                  }`}
                  title={t.isActive === false ? 'Reactivar' : 'Desactivar'}
                >
                  {t.isActive === false ? (
                    <ToggleRight className="w-3.5 h-3.5" />
                  ) : (
                    <ToggleLeft className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit modal */}
      {showEditModal && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="font-semibold text-gray-900">Editar Documento Patrón</h2>
              <button onClick={() => { setShowEditModal(false); setEditingTemplate(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del Formato</label>
                <input required value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Versión</label>
                <input required value={editFormData.version} onChange={e => setEditFormData({...editFormData, version: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" placeholder="1.0" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-primary-500 text-white rounded-lg font-semibold text-sm hover:bg-primary-600 transition mt-2">Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}

      {/* Toggle confirmation */}
      {confirmToggleTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5 space-y-3">
              <h3 className="font-semibold text-gray-900 text-lg">
                {confirmToggleTemplate.isActive === false ? 'Reactivar Patrón' : 'Desactivar Patrón'}
              </h3>
              <p className="text-sm text-gray-500">
                {confirmToggleTemplate.isActive === false
                  ? `¿Reactivar "${confirmToggleTemplate.name}"? Estará disponible para nuevas cargas de avances.`
                  : `¿Desactivar "${confirmToggleTemplate.name}"? No se podrá usar para nuevas cargas, pero las tesis ya evaluadas no se verán afectadas.`}
              </p>
              <p className="text-xs text-gray-400">Las tesis ya evaluadas con este patrón mantienen sus datos intactos.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setConfirmToggleTemplate(null)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-white transition">
                Cancelar
              </button>
              <button
                onClick={() => handleToggle(confirmToggleTemplate)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
                  confirmToggleTemplate.isActive === false
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {confirmToggleTemplate.isActive === false ? 'Sí, reactivar' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Structure detail modal */}
      {selectedSchemaTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="font-semibold text-gray-900 text-lg">Estructura Detallada</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedSchemaTemplate.name} — Versión {selectedSchemaTemplate.version}</p>
              </div>
              <button onClick={() => setSelectedSchemaTemplate(null)} className="text-gray-400 hover:text-gray-600 font-semibold text-lg">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {selectedSchemaTemplate.extractedSchema ? (
                <div className="space-y-4">
                  <div className="flex gap-4 text-xs">
                    <div className="bg-gray-100 p-2.5 rounded-lg flex-1">
                      <span className="font-semibold text-gray-500 block">Estilo de Citas</span>
                      <span className="text-gray-800 font-bold uppercase">{selectedSchemaTemplate.extractedSchema.citationStyle || selectedSchemaTemplate.citationStyle || 'No detectado'}</span>
                    </div>
                    <div className="bg-gray-100 p-2.5 rounded-lg flex-1">
                      <span className="font-semibold text-gray-500 block">Estilo de Redacción</span>
                      <span className="text-gray-800 font-bold">{selectedSchemaTemplate.extractedSchema.writingStyle || 'Científico / Académico'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">JSON Completo de la Estructura</h3>
                    <div className="relative">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedSchemaTemplate.extractedSchema, null, 2));
                          alert('¡JSON copiado al portapapeles!');
                        }}
                        className="absolute right-3 top-3 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] border border-white/20 transition font-sans"
                      >
                        Copiar JSON
                      </button>
                      <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl overflow-auto text-xs font-mono max-h-[50vh] leading-relaxed shadow-inner">
                        {JSON.stringify(selectedSchemaTemplate.extractedSchema, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <BookTemplate className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-semibold">Este formato no tiene una estructura extraída por IA.</p>
                  <p className="text-xs mt-1 text-gray-400">Prueba subiendo un documento patrón real (PDF o Word) para procesarlo.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button 
                onClick={() => setSelectedSchemaTemplate(null)} 
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold transition"
              >
                Cerrar Estructura
              </button>
            </div>
          </div>
        </div>
      )}
      {/* File viewer modal (PDF) */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-sm">{viewingFile.name}</h2>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">{viewingFile.fileType}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewingFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir en nueva pestaña
                </a>
                <button
                  onClick={() => setViewingFile(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              <iframe
                src={viewingFile.url}
                className="w-full h-full border-0"
                title={viewingFile.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
