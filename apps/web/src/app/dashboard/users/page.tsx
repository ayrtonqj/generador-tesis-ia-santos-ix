'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast, Toaster } from 'sonner';
import {
  Users as UsersIcon, Plus, UserCheck, Trash2, Search,
  Edit3, Key, ShieldAlert, ShieldCheck, Loader2, X, Check,
  ChevronLeft, ChevronRight, Download,
} from 'lucide-react';

const ROLE_OPTIONS = ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'] as const;
const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Estudiante', ADVISOR: 'Asesor',
  COORDINATOR: 'Coordinador', ADMIN: 'Administrador',
};
const ROLE_COLORS: Record<string, string> = {
  STUDENT: 'bg-blue-100 text-blue-700',
  ADVISOR: 'bg-emerald-100 text-emerald-700',
  COORDINATOR: 'bg-amber-100 text-amber-700',
  ADMIN: 'bg-purple-100 text-purple-700',
};

interface User {
  id: string; email: string; name: string; role: string;
  programId?: string; isActive: boolean; avatarUrl?: string;
  program?: { id: string; name: string } | null;
  advisor?: { id: string; name: string } | null;
  _count?: { advisees: number; advances: number };
  createdAt: string;
}

interface Program {
  id: string; name: string; code: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [programs, setPrograms] = useState<Program[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStudent, setAssignStudent] = useState<User | null>(null);
  const [showResetPwd, setShowResetPwd] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', role: 'STUDENT', programId: '', advisorId: '',
  });
  const [editForm, setEditForm] = useState({
    name: '', role: 'STUDENT', programId: '', advisorId: '', isActive: true,
  });
  const [assignAdvisorId, setAssignAdvisorId] = useState('');

  // Loading states
  const [submitting, setSubmitting] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);

  const advisors = users.filter(u => u.role === 'ADVISOR');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (roleFilter) params.role = roleFilter;
      if (search) params.search = search;
      const res = await api.get('/users', { params });
      const data = res.data;
      setUsers(Array.isArray(data.data) ? data.data : []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setUsers([]);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await api.get('/users/programs');
      setPrograms(Array.isArray(res.data) ? res.data : []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [roleFilter, search]);

  // ── Selection ──
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === users.length && users.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map(u => u.id)));
    }
  };

  // ── Create ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/users', createForm);
      toast.success('Usuario creado correctamente');
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', role: 'STUDENT', programId: '', advisorId: '' });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al crear usuario');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit ──
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      programId: user.programId || '',
      advisorId: user.advisor?.id || '',
      isActive: user.isActive,
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await api.put(`/users/${editingUser.id}`, editForm);
      toast.success('Usuario actualizado');
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al actualizar usuario');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete / Reactivate ──
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/users/${id}`);
      toast.success('Usuario desactivado', {
        action: { label: 'Deshacer', onClick: () => handleReactivate(id) },
      });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al desactivar usuario');
    }
    setShowDeleteConfirm(null);
  };

  const handleReactivate = async (id: string) => {
    try {
      await api.post(`/users/${id}/reactivate`);
      toast.success('Usuario reactivado');
      fetchUsers();
    } catch {
      toast.error('Error al reactivar');
    }
  };

  // ── Assign Advisor ──
  const openAssignModal = (user: User) => {
    setAssignStudent(user);
    setAssignAdvisorId(user.advisor?.id || '');
    setShowAssignModal(true);
  };

  const handleAssignAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudent || !assignAdvisorId) return;
    setSubmitting(true);
    try {
      await api.post(`/users/${assignStudent.id}/assign-advisor/${assignAdvisorId}`);
      toast.success('Asesor asignado');
      setShowAssignModal(false);
      setAssignStudent(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al asignar asesor');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Bulk Assign ──
  const handleBulkAssign = async () => {
    if (selected.size === 0 || !assignAdvisorId) return;
    setSubmitting(true);
    try {
      const res = await api.post('/users/bulk-assign-advisor', {
        studentIds: Array.from(selected),
        advisorId: assignAdvisorId,
      });
      toast.success(`${res.data.assigned} estudiante(s) asignados al asesor`);
      setSelected(new Set());
      setBulkMode(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error en asignación masiva');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset Password ──
  const handleResetPassword = async (id: string) => {
    try {
      const res = await api.post(`/users/${id}/reset-password`);
      setTempPassword(res.data.tempPassword);
      setShowResetPwd(id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al resetear contraseña');
    }
  };

  // ── Bulk actions ──
  const bulkStudents = users.filter(u => selected.has(u.id) && u.role === 'STUDENT');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" richColors />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gesti&oacute;n de Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} usuario{total !== 1 ? 's' : ''} &middot; P&aacute;gina {page} de {totalPages}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setRoleFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !roleFilter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >Todos</button>
          {ROLE_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                roleFilter === r ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >{ROLE_LABELS[r]}</button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-indigo-800">{selected.size} seleccionado(s)</span>
          {bulkStudents.length > 0 && (
            <>
              <select
                value={assignAdvisorId}
                onChange={e => setAssignAdvisorId(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-indigo-300 text-sm bg-white"
              >
                <option value="">Asignar asesor...</option>
                {advisors.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {assignAdvisorId && (
                <button
                  onClick={handleBulkAssign}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Asignando...' : 'Asignar'}
                </button>
              )}
            </>
          )}
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700 ml-auto">
            Limpiar selecci&oacute;n
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selected.size === users.length}
                    onChange={selectAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Programa</th>
                <th className="px-4 py-3 font-medium">Asesor / Asesora</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400"><Loader2 className="w-6 h-6 inline animate-spin" /> Cargando...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No hay usuarios con estos filtros</p>
                </td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50/50 transition ${!u.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs shrink-0">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{u.program?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {u.role === 'STUDENT' ? (u.advisor?.name || '—') : (
                        u._count ? `${u._count.advisees} asesorado(s)` : '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          <X className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEditModal(u)} title="Editar" className="p-1.5 text-gray-400 hover:text-indigo-600 transition">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {u.role === 'STUDENT' && (
                          <button onClick={() => openAssignModal(u)} title="Asignar Asesor" className="p-1.5 text-gray-400 hover:text-cyan-600 transition">
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleResetPassword(u.id)} title="Resetear Contrase&ntilde;a" className="p-1.5 text-gray-400 hover:text-amber-600 transition">
                          <Key className="w-4 h-4" />
                        </button>
                        {u.isActive ? (
                          <button onClick={() => setShowDeleteConfirm(u.id)} title="Desactivar" className="p-1.5 text-gray-400 hover:text-red-600 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleReactivate(u.id)} title="Reactivar" className="p-1.5 text-gray-400 hover:text-emerald-600 transition">
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              Mostrando {users.length} de {total} usuarios
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                      page === pageNum ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >{pageNum}</button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Registrar Nuevo Usuario</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nombre Completo</label>
                  <input required value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email Institucional</label>
                  <input required type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Contrase&ntilde;a</label>
                  <input required type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
                  <select value={createForm.role} onChange={e => setCreateForm({...createForm, role: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Programa</label>
                  <select value={createForm.programId} onChange={e => setCreateForm({...createForm, programId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                    <option value="">Sin programa</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {createForm.role === 'STUDENT' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Asesor</label>
                    <select value={createForm.advisorId} onChange={e => setCreateForm({...createForm, advisorId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                      <option value="">Sin asesor</option>
                      {advisors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition mt-2 disabled:opacity-50">
                {submitting ? 'Creando...' : 'Crear Usuario'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Editar Usuario</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                  <input required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input readOnly value={editingUser.email} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Programa</label>
                  <select value={editForm.programId} onChange={e => setEditForm({...editForm, programId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                    <option value="">Sin programa</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {editForm.role === 'STUDENT' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Asesor</label>
                    <select value={editForm.advisorId} onChange={e => setEditForm({...editForm, advisorId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                      <option value="">Sin asesor</option>
                      {advisors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                  <div className="flex gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="isActive" checked={editForm.isActive} onChange={() => setEditForm({...editForm, isActive: true})} className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-gray-700">Activo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="isActive" checked={!editForm.isActive} onChange={() => setEditForm({...editForm, isActive: false})} className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-gray-700">Inactivo</span>
                    </label>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition mt-2 disabled:opacity-50">
                {submitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Desactivar Usuario</h3>
              <p className="text-sm text-gray-500 mb-1">El usuario dejar&aacute; de tener acceso al sistema.</p>
              <p className="text-xs text-gray-400">Puedes reactivarlo despu&eacute;s desde la lista.</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancelar</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">Desactivar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Advisor Modal ── */}
      {showAssignModal && assignStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Asignar Asesor</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAssignAdvisor} className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Asignar asesor a <strong className="text-gray-800">{assignStudent.name}</strong>
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Asesor</label>
                <select value={assignAdvisorId} onChange={e => setAssignAdvisorId(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/20">
                  <option value="">-- Seleccionar --</option>
                  {advisors.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={submitting || !assignAdvisorId} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50">
                {submitting ? 'Asignando...' : 'Confirmar Asignaci&oacute;n'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {showResetPwd && tempPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowResetPwd(null); setTempPassword(''); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Contrase&ntilde;a Temporal</h2>
              <button onClick={() => { setShowResetPwd(null); setTempPassword(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>&#9888; Importante:</strong> Esta contrase&ntilde;a solo se muestra una vez. C&oacute;piala y comp&aacute;rtela con el usuario.
              </div>
              <div className="bg-gray-100 rounded-lg p-4 text-center">
                <code className="text-xl font-mono font-bold text-gray-900 select-all">{tempPassword}</code>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Copiado al portapapeles'); }}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition"
              >Copiar Contrase&ntilde;a</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
