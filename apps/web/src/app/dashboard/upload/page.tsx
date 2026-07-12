'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Upload, FileText, User } from 'lucide-react';
import Cookies from 'js-cookie';

export default function UploadPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [title, setTitle] = useState('');
  const [advanceType, setAdvanceType] = useState('chapter_1');
  const [templateId, setTemplateId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  useEffect(() => {
    const userData = Cookies.get('kimy_user');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        if (parsed.role === 'ADMIN' || parsed.role === 'COORDINATOR') {
          api.get('/users?role=STUDENT&limit=200')
            .then(r => { setStudents(Array.isArray(r.data) ? r.data : r.data.users || r.data.data || []); })
            .catch(e => console.error('Error cargando estudiantes:', e?.response?.status, e?.message));
        }
      } catch {}
    }
    api.get('/templates').then(r => { console.log('Templates cargados:', r.data.length); setTemplates(r.data); }).catch(e => console.error('Error cargando templates:', e?.response?.status, e?.message));
  }, []);

  const isAdminOrCoordinator = user && (user.role === 'ADMIN' || user.role === 'COORDINATOR');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !templateId) return;
    if (isAdminOrCoordinator && !selectedStudentId) { setMsg('Error: Debes seleccionar un estudiante'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    fd.append('advanceType', advanceType);
    fd.append('templateId', templateId);
    if (isAdminOrCoordinator) {
      fd.append('studentId', selectedStudentId);
    }
    try {
      await api.post('/advances/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      setMsg('¡Avance subido exitosamente! Se ha encolado para análisis IA.');
      setFile(null); setTitle(''); setSelectedStudentId('');
    } catch (err: any) {
      setMsg('Error: ' + (err.response?.data?.message || 'No se pudo subir'));
    } finally { setUploading(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Subir Avance de Tesis</h1>
      <p className="text-sm text-gray-500 mb-6">{isAdminOrCoordinator ? 'Sube un documento Word o PDF para análisis automático en nombre del estudiante' : 'Sube tu documento Word o PDF para análisis automático'}</p>

      {msg && <div className={`p-3 rounded-lg mb-6 text-sm ${msg.startsWith('Error')?'bg-red-50 text-red-700 border border-red-200':'bg-green-50 text-green-700 border border-green-200'}`}>{msg}</div>}

      <form onSubmit={handleUpload} className="bg-white rounded-xl border p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Título del avance</label>
          <input type="text" value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" placeholder="Ej: Capítulo 1 - Marco Teórico" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de avance</label>
            <select value={advanceType} onChange={e=>setAdvanceType(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm">
              <option value="chapter_1">Capítulo 1</option><option value="chapter_2">Capítulo 2</option>
              <option value="chapter_3">Capítulo 3</option><option value="chapter_4">Capítulo 4</option>
              <option value="chapter_5">Capítulo 5</option><option value="full">Tesis completa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Documento patrón</label>
            <select value={templateId} onChange={e=>setTemplateId(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm" required>
              <option value="">Seleccionar...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} v{t.version}</option>)}
            </select>
          </div>
        </div>
        {isAdminOrCoordinator && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" />
              Estudiante
            </label>
            <select value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm" required>
              <option value="">Seleccionar estudiante...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Archivo</label>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer">
            {file ? (
              <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary-500"/><span className="text-sm text-gray-700">{file.name}</span><span className="text-xs text-gray-400">({(file.size/1024/1024).toFixed(1)} MB)</span></div>
            ) : (
              <div className="text-center"><Upload className="w-8 h-8 text-gray-400 mx-auto mb-2"/><p className="text-sm text-gray-500">Arrastra o haz clic para subir</p><p className="text-xs text-gray-400 mt-1">Word (.docx) o PDF — Máx. 50MB</p></div>
            )}
            <input type="file" accept=".pdf,.docx" onChange={e=>setFile(e.target.files?.[0]||null)} className="hidden"/>
          </label>
        </div>
        <button type="submit" disabled={uploading||!file} className="w-full py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
          {uploading ? 'Subiendo...' : 'Subir y analizar con IA'}
        </button>
      </form>
    </div>
  );
}
