'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Shield, Bell, User, Camera, LogOut, CheckCircle2, Loader2, Smartphone, Key, Copy, Download, AlertTriangle, Brain, Cpu, Zap, Sparkles, Lock } from 'lucide-react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados interactivos para todos los formularios
  const [formData, setFormData] = useState({
    institutionName: '',
    maxGrade: 20,
    aiModel: 'gpt-4o',
    aiProvider: 'openai',
    approvalThreshold: 60,
    rigorLevel: 'Alto',
    fullName: '',
    email: '',
    signature: '',
    notifyComplete: true,
    notifyPush: false,
    notifyWeekly: true,
  });

  // Estados para cambio de contraseña
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Estados 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorQr, setTwoFactorQr] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSetupError, setTwoFactorSetupError] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableError, setDisableError] = useState('');

  // Integración de ORCID
  const [userRole, setUserRole] = useState('');
  const [orcidProfile, setOrcidProfile] = useState<any>(null);
  const [orcidLoading, setOrcidLoading] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<Record<string, boolean>>({});

  const fetchOrcidProfile = async () => {
    try {
      setOrcidLoading(true);
      const res = await api.get('/orcid/profile');
      setOrcidProfile(res.data);
    } catch (err) {
      console.log('No orcid profile linked yet');
    } finally {
      setOrcidLoading(false);
    }
  };

  // 1. Cargar datos del Backend al montar la página
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Obtener perfil del usuario
        const profileRes = await api.get('/auth/me');
        const user = profileRes.data;
        setUserRole(user.role || '');
        if (user.role !== 'ADMIN' && (activeTab === 'general' || activeTab === 'ia')) {
          setActiveTab('perfil');
        }

        // Obtener configuraciones globales
        const settingsRes = await api.get('/settings');
        const settings = settingsRes.data;

        setFormData({
          institutionName: settings.institutionName || 'Universidad Nacional de Trujillo',
          maxGrade: settings.maxGrade || 20,
          aiModel: settings.aiModel || 'gpt-4o',
          aiProvider: settings.aiProvider || 'openai',
          approvalThreshold: settings.approvalThreshold ?? 60,
          rigorLevel: settings.rigorLevel || 'Alto',
          fullName: user.name || '',
          email: user.email || '',
          signature: user.signature || '',
          notifyComplete: user.notifyComplete ?? true,
          notifyPush: user.notifyPush ?? false,
          notifyWeekly: user.notifyWeekly ?? true,
        });

        if (user.twoFactorEnabled) {
          setTwoFactorEnabled(true);
        }

        if (user.avatarUrl) {
          setAvatarPreview(user.avatarUrl);
        }

        if (user.role === 'ADVISOR') {
          try {
            const res = await api.get('/orcid/profile');
            setOrcidProfile(res.data);
          } catch (err) {
            console.log('No orcid profile linked yet');
          }
        }

        try {
          const providersRes = await api.get('/settings/providers');
          setAvailableProviders(providersRes.data);
        } catch (err) {
          console.log('Could not fetch available providers');
        }
      } catch (err) {
        console.error('Error cargando configuración:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleConnectOrcid = async () => {
    try {
      const res = await api.get('/orcid/connect');
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      alert('Error al iniciar vinculación con ORCID');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'aiProvider') {
      const defaultModels: Record<string, string> = {
        openai: 'gpt-4o',
        deepseek: 'deepseek-chat',
        gemini: 'gemini-3.1-flash-lite',
        groq: 'llama-3.3-70b-versatile',
        claude: 'claude-3-5-sonnet-20241022',
        minimax: 'MiniMax-Text-01',
      };
      setFormData(prev => ({ 
        ...prev, 
        aiProvider: value,
        aiModel: defaultModels[value] || prev.aiModel 
      }));
    } else if (name === 'aiModel') {
      // Inferencia automática bidireccional del proveedor según el modelo seleccionado
      const modelToProvider: Record<string, string> = {
        'gpt-4o': 'openai',
        'gpt-4o-mini': 'openai',
        'deepseek-chat': 'deepseek',
        'deepseek-reasoner': 'deepseek',
        'gemini-3.5-flash': 'gemini',
        'gemini-3-flash': 'gemini',
        'gemini-3.1-flash-lite': 'gemini',
        'gemini-2.5-flash-lite': 'gemini',
        'gemini-2.5-flash': 'gemini',
        'llama-3.3-70b-versatile': 'groq',
        'llama-3.1-8b-instant': 'groq',
        'claude-3-5-sonnet-20241022': 'claude',
        'claude-3-5-haiku-20241022': 'claude',
        'claude-3-opus-20240229': 'claude',
        'MiniMax-Text-01': 'minimax',
        'MiniMax-M1': 'minimax',
      };
      const inferredProvider = modelToProvider[value];
      setFormData(prev => ({
        ...prev,
        aiModel: value,
        aiProvider: inferredProvider || prev.aiProvider
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 2. Guardar cambios en el Backend (Persistencia Real)
  const handleSave = async () => {
    try {
      setIsSaved(false);
      
      // Siempre guardar perfil del usuario (todos los roles)
      await api.put('/users/me/profile', {
        name: formData.fullName,
        signature: formData.signature,
        avatarUrl: avatarPreview,
        notifyComplete: formData.notifyComplete,
        notifyPush: formData.notifyPush,
        notifyWeekly: formData.notifyWeekly,
      });

      // Solo ADMIN guarda configuraciones globales del sistema
      if (userRole === 'ADMIN') {
        await api.put('/settings', {
          institutionName: formData.institutionName,
          maxGrade: Number(formData.maxGrade),
          aiModel: formData.aiModel,
          aiProvider: formData.aiProvider,
          approvalThreshold: Number(formData.approvalThreshold),
          rigorLevel: formData.rigorLevel,
        });
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Error guardando configuración:', err);
    }
  };

  // 3. Guardar nueva contraseña
  const handleUpdatePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwords.currentPassword || !passwords.newPassword) {
      setPasswordError('Rellene los campos de contraseña.');
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.');
      return;
    }

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      setPasswordSuccess('Contraseña cambiada con éxito.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Error al cambiar contraseña.');
    }
  };

  // ── Handlers 2FA ─────────────────────────────────
  const handleEnable2fa = async () => {
    setTwoFactorLoading(true);
    setTwoFactorSetupError('');
    try {
      const res = await api.post('/auth/2fa/enable');
      setTwoFactorQr(res.data.qrCode);
      setShowTwoFactorSetup(true);
    } catch (err: any) {
      setTwoFactorSetupError(err.response?.data?.message || 'Error al iniciar configuración 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleConfirm2fa = async () => {
    setTwoFactorLoading(true);
    setTwoFactorSetupError('');
    try {
      const res = await api.post('/auth/2fa/confirm-enable', { code: twoFactorCode });
      setBackupCodes(res.data.backupCodes || []);
      setShowBackupCodes(true);
      setTwoFactorEnabled(true);
      setShowTwoFactorSetup(false);
      setTwoFactorCode('');
    } catch (err: any) {
      setTwoFactorSetupError(err.response?.data?.message || 'Código inválido');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    setTwoFactorLoading(true);
    setDisableError('');
    try {
      await api.post('/auth/2fa/disable', { currentPassword: disablePassword });
      setTwoFactorEnabled(false);
      setShowDisableConfirm(false);
      setDisablePassword('');
      setBackupCodes([]);
      setShowBackupCodes(false);
    } catch (err: any) {
      setDisableError(err.response?.data?.message || 'Error al desactivar 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 3000);
  };

  if (loading) {
    return (
      <div className="p-6 min-h-[400px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-sm text-gray-500">Cargando preferencias del sistema...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ajustes generales del sistema KIMY y cuenta de usuario</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {userRole === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('general')}
              className={`px-5 py-3.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-primary-500 text-primary-600 bg-primary-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <Settings className="w-4 h-4" /> General
            </button>
          )}
          <button 
            onClick={() => setActiveTab('perfil')}
            className={`px-5 py-3.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'perfil' ? 'border-primary-500 text-primary-600 bg-primary-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <User className="w-4 h-4" /> Perfil
          </button>
          <button 
            onClick={() => setActiveTab('notificaciones')}
            className={`px-5 py-3.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'notificaciones' ? 'border-primary-500 text-primary-600 bg-primary-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <Bell className="w-4 h-4" /> Notificaciones
          </button>
          {userRole === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('ia')}
              className={`px-5 py-3.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'ia' ? 'border-primary-500 text-primary-600 bg-primary-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <Brain className="w-4 h-4" /> IA
            </button>
          )}
          <button 
            onClick={() => setActiveTab('seguridad')}
            className={`px-5 py-3.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'seguridad' ? 'border-primary-500 text-primary-600 bg-primary-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <Shield className="w-4 h-4" /> Seguridad
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6 min-h-[400px]">
          {activeTab === 'general' && userRole === 'ADMIN' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-medium text-gray-900 border-b border-gray-100 pb-2">Preferencias Institucionales</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la Institución</label>
                  <input name="institutionName" value={formData.institutionName} onChange={handleInputChange} type="text" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Escala de Calificación Máxima</label>
                  <input name="maxGrade" value={formData.maxGrade} onChange={handleInputChange} type="number" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo de IA Principal</label>
                  <select name="aiModel" value={formData.aiModel} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow">
                    <option value="gpt-4o">GPT-4o (Recomendado)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Rápido)</option>
                    <option value="deepseek-chat">DeepSeek Chat</option>
                    <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Gratis · 20 RPD)</option>
                    <option value="gemini-3-flash">Gemini 3 Flash (Gratis · 20 RPD)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Gratis · 500 RPD · Recomendado)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Gratis · 20 RPD)</option>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Gratis · 20 RPD)</option>
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B (Groq Rápido)</option>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Rápido)</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus (Potente)</option>
                    <option value="MiniMax-Text-01">MiniMax Text-01</option>
                    <option value="MiniMax-M1">MiniMax M1 (Razonamiento)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nivel de Rigurosidad IA</label>
                  <select name="rigorLevel" value={formData.rigorLevel} onChange={handleInputChange} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow">
                    <option value="Alto">Alto (Estricto)</option>
                    <option value="Medio">Medio (Normal)</option>
                    <option value="Bajo">Bajo (Tolerante)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'perfil' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-medium text-gray-900 border-b border-gray-100 pb-2">Información Personal</h2>
              
              <div className="flex items-center gap-6 mb-4">
                <div className="relative">
                  {/* Foto de perfil o Inicial */}
                  <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-3xl font-bold border-4 border-white shadow-sm overflow-hidden">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      formData.fullName ? formData.fullName.charAt(0).toUpperCase() : 'A'
                    )}
                  </div>
                  
                  {/* Botón flotante de cámara */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:text-primary-600 shadow-sm transition active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  {/* Input de archivo oculto */}
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                  />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Foto de Perfil</h3>
                  <p className="text-sm text-gray-500 mt-1">Sube una foto clara en formato JPG o PNG.<br/>Tamaño máximo 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre Completo</label>
                  <input name="fullName" value={formData.fullName} onChange={handleInputChange} type="text" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo Electrónico</label>
                  <input name="email" value={formData.email} onChange={handleInputChange} type="email" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow bg-gray-50 text-gray-500 cursor-not-allowed" readOnly />
                  <p className="text-xs text-gray-500 mt-1">El correo está bloqueado por el administrador.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Firma de Grado / Título (Aparecerá en actas)</label>
                  <input name="signature" value={formData.signature} onChange={handleInputChange} type="text" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow" />
                </div>
              </div>

              {/* Sección Interactiva de ORCID iD para Asesores */}
              {userRole === 'ADVISOR' && (
                <div className="mt-8 border-t border-gray-100 pt-8 space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 border-b border-gray-100 pb-2">Filiación Científica e Integraciones</h3>
                  
                  {orcidLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                      <Loader2 className="w-4 h-4 text-cyan-600 animate-spin" />
                      Sincronizando con ORCID...
                    </div>
                  ) : orcidProfile ? (
                    <div className="bg-gradient-to-br from-cyan-50/40 via-white to-cyan-50/20 border border-cyan-100 rounded-xl p-5 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#A6C307] flex items-center justify-center font-bold text-white shadow-sm text-sm">
                            iD
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 flex items-center gap-1.5">
                              ORCID Vinculado Exitosamente
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            </h4>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{orcidProfile.orcidId}</p>
                          </div>
                        </div>
                        <button
                          onClick={handleConnectOrcid}
                          className="text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded-lg border border-cyan-100 transition active:scale-95"
                        >
                          Sincronizar Publicaciones
                        </button>
                      </div>

                      {/* Lista de publicaciones */}
                      <div className="space-y-2 pt-2">
                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Publicaciones Sincronizadas ({orcidProfile.publications?.length || 0})</h5>
                        {orcidProfile.publications && orcidProfile.publications.length > 0 ? (
                          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg bg-white overflow-hidden max-h-60 overflow-y-auto">
                            {orcidProfile.publications.map((pub: any) => (
                              <div key={pub.id} className="p-3 text-xs sm:text-sm hover:bg-gray-50/50 transition flex justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="font-medium text-gray-900 leading-tight">{pub.title}</p>
                                  <p className="text-xs text-gray-500">
                                    {pub.journal || 'Revista no especificada'} • {pub.year || 'Año N/A'}
                                  </p>
                                </div>
                                {pub.doi && (
                                  <span className="text-[10px] bg-cyan-50 border border-cyan-100 text-cyan-700 px-2 py-0.5 rounded font-mono self-start flex-shrink-0">
                                    DOI: {pub.doi}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic py-2">No se encontraron publicaciones públicas vinculadas en este perfil de ORCID.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center space-y-4">
                      <div className="w-12 h-12 rounded-full bg-cyan-50 text-[#A6C307] flex items-center justify-center mx-auto border border-cyan-100 shadow-sm text-lg font-bold">
                        iD
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Vincular con tu Identificador ORCID</h4>
                        <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                          Importa tus publicaciones científicas y filiación científica directamente de ORCID para la validación de idoneidad en las supervisiones de tesis.
                        </p>
                      </div>
                      <button
                        onClick={handleConnectOrcid}
                        className="px-5 py-2 bg-[#A6C307] hover:bg-[#8FAD05] text-white text-sm font-semibold rounded-lg shadow-sm transition active:scale-95 inline-flex items-center gap-2"
                      >
                        Vincular Cuenta ORCID iD
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notificaciones' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-medium text-gray-900 border-b border-gray-100 pb-2">Preferencias de Alertas</h2>
              
              <div className="space-y-4">
                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <h3 className="font-medium text-gray-900">Análisis IA Completado</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Recibir un correo cuando el bot termine de evaluar una tesis.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input name="notifyComplete" checked={formData.notifyComplete} onChange={handleInputChange} type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <h3 className="font-medium text-gray-900">Notificaciones Push (Navegador)</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Mostrar alertas emergentes mientras usas la plataforma.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input name="notifyPush" checked={formData.notifyPush} onChange={handleInputChange} type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <h3 className="font-medium text-gray-900">Reporte Semanal de Similitud</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Resumen automatizado en PDF con métricas de plagio de tus alumnos.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input name="notifyWeekly" checked={formData.notifyWeekly} onChange={handleInputChange} type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ia' && userRole === 'ADMIN' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-medium text-gray-900 border-b border-gray-100 pb-2">Preferencias de Inteligencia Artificial</h2>
              
              {/* Proveedor Principal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor de IA Principal</label>
                <p className="text-xs text-gray-500 mb-3">Selecciona qué motor de IA se usará para el análisis de tesis.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { id: 'openai', name: 'OpenAI GPT-4o', icon: Sparkles, color: 'text-green-600', bg: 'bg-green-50' },
                    { id: 'deepseek', name: 'DeepSeek V3', icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { id: 'gemini', name: 'Gemini 3.1 Flash Lite', icon: Cpu, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { id: 'groq', name: 'Groq Llama 3', icon: Cpu, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { id: 'claude', name: 'Claude 3.5 Sonnet', icon: Brain, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { id: 'minimax', name: 'MiniMax Text-01', icon: Zap, color: 'text-pink-600', bg: 'bg-pink-50' },
                  ].map((p) => {
                    const isAvailable = availableProviders[p.id] === true;
                    const isSelected = formData.aiProvider === p.id;
                    return (
                    <label
                      key={p.id}
                      title={!isAvailable ? `Agrega ${p.id.toUpperCase()}_API_KEY en el archivo .env para activar este proveedor` : ''}
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        !isAvailable
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-primary-500 bg-primary-50/30 shadow-sm cursor-pointer'
                          : 'border-gray-200 hover:border-gray-300 bg-white cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="aiProvider"
                        value={p.id}
                        checked={isSelected}
                        disabled={!isAvailable}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-primary-100 text-primary-600' : `${p.bg} ${p.color}`
                      }`}>
                        <p.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isAvailable ? (
                            <><span className="w-2 h-2 rounded-full bg-green-500"></span><span className="text-xs text-green-600 font-medium">API Key configurada</span></>
                          ) : (
                            <><Lock className="w-3 h-3 text-gray-400" /><span className="text-xs text-gray-400">Sin API Key</span></>
                          )}
                        </div>
                      </div>
                      {isSelected && isAvailable && (
                        <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </label>
                  )})}
                </div>
              </div>

              {/* Modelo por defecto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo por Defecto</label>
                <select
                  name="aiModel"
                  value={formData.aiModel}
                  onChange={handleInputChange}
                  className="w-full max-w-xs px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow"
                >
                  <option value="gpt-4o">GPT-4o (Recomendado)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Rápido)</option>
                  <option value="deepseek-chat">DeepSeek Chat</option>
                  <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Gratis · 20 RPD)</option>
                  <option value="gemini-3-flash">Gemini 3 Flash (Gratis · 20 RPD)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Gratis · 500 RPD · Recomendado)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Gratis · 20 RPD)</option>
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Gratis · 20 RPD)</option>
                  <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B (Groq Rápido)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Rápido)</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus (Potente)</option>
                  <option value="MiniMax-Text-01">MiniMax Text-01</option>
                  <option value="MiniMax-M1">MiniMax M1 (Razonamiento)</option>
                </select>
              </div>

              {/* Umbral de aprobación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Umbral de Aprobación IA: <span className="font-bold text-primary-600">{formData.approvalThreshold}%</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Puntuación mínima para considerar un avance como "aprobado por IA".</p>
                <input
                  type="range"
                  name="approvalThreshold"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.approvalThreshold}
                  onChange={(e) => setFormData(prev => ({ ...prev, approvalThreshold: Number(e.target.value) }))}
                  className="w-full max-w-xs"
                />
                <div className="flex justify-between max-w-xs text-xs text-gray-400 mt-1">
                  <span>0% (Tolerante)</span>
                  <span>100% (Estricto)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'seguridad' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-medium text-gray-900 border-b border-gray-100 pb-2">Seguridad de la Cuenta</h2>
              
              {/* Cambio de contraseña */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-700">Cambiar Contraseña</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña Actual</label>
                    <input name="currentPassword" value={passwords.currentPassword} onChange={handlePasswordChange} type="password" placeholder="••••••••" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva Contraseña</label>
                    <input name="newPassword" value={passwords.newPassword} onChange={handlePasswordChange} type="password" placeholder="Mínimo 8 caracteres" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Nueva Contraseña</label>
                    <input name="confirmPassword" value={passwords.confirmPassword} onChange={handlePasswordChange} type="password" placeholder="" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow" />
                  </div>
                </div>

                {passwordError && (
                  <p className="text-sm font-medium text-red-600 animate-in fade-in">{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="text-sm font-medium text-green-600 animate-in fade-in">{passwordSuccess}</p>
                )}

                <button 
                  onClick={handleUpdatePassword}
                  className="px-4 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition flex items-center gap-2 active:scale-95"
                >
                  Actualizar Contraseña
                </button>
              </div>

              {/* Autenticación de Dos Factores */}
              <div className="pt-6 mt-6 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-cyan-600" />
                      Autenticación de Dos Factores (2FA)
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Añade una capa extra de seguridad usando Google Authenticator o similar.
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${twoFactorEnabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                    {twoFactorEnabled ? '✓ Activado' : 'Desactivado'}
                  </div>
                </div>

                {!showTwoFactorSetup && !showBackupCodes && (
                  <div>
                    {!twoFactorEnabled ? (
                      <button
                        onClick={handleEnable2fa}
                        disabled={twoFactorLoading}
                        className="px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition flex items-center gap-2 disabled:opacity-50 active:scale-95"
                      >
                        {twoFactorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Activar 2FA
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowDisableConfirm(true)}
                        className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center gap-2 active:scale-95"
                      >
                        Desactivar 2FA
                      </button>
                    )}
                  </div>
                )}

                {/* Setup 2FA - QR */}
                {showTwoFactorSetup && (
                  <div className="bg-cyan-50/30 border border-cyan-100 rounded-xl p-5 space-y-4">
                    <h4 className="font-medium text-gray-900">Escanea el código QR</h4>
                    <p className="text-sm text-gray-500">
                      Abre tu app de autenticación (Google Authenticator, Authy, etc.) y escanea este código QR.
                    </p>
                    <div className="flex justify-center">
                      {twoFactorQr && (
                        <img src={twoFactorQr} alt="Código QR 2FA" className="w-48 h-48 border-2 border-white shadow-md rounded-lg" />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Ingresa el código de 6 dígitos generado por la app
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center font-mono tracking-[0.3em] outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-shadow"
                          placeholder="••••••"
                          autoComplete="one-time-code"
                        />
                        <button
                          onClick={handleConfirm2fa}
                          disabled={twoFactorLoading || twoFactorCode.length !== 6}
                          className="px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition disabled:opacity-50 flex items-center gap-2 active:scale-95"
                        >
                          {twoFactorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                          Verificar
                        </button>
                      </div>
                    </div>
                    {twoFactorSetupError && (
                      <p className="text-sm font-medium text-red-600">{twoFactorSetupError}</p>
                    )}
                  </div>
                )}

                {/* Backup Codes */}
                {showBackupCodes && (
                  <div className="bg-amber-50/30 border border-amber-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800">Códigos de Respaldo</h4>
                        <p className="text-sm text-amber-700">
                          Guarda estos códigos en un lugar seguro. Cada código solo puede usarse una vez.
                          Si pierdes tu dispositivo de autenticación, estos códigos son la única forma de recuperar tu cuenta.
                        </p>
                      </div>
                    </div>
                    <div className="bg-white border border-amber-200 rounded-lg p-4 font-mono text-sm space-y-1">
                      {backupCodes.map((code, i) => (
                        <div key={i} className="flex items-center gap-2 text-gray-800">
                          <span className="text-amber-500 w-6 text-right">{i + 1}.</span>
                          <span className="tracking-wider">{code}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyBackupCodes}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedCodes ? 'Copiado' : 'Copiar códigos'}
                      </button>
                      <button
                        onClick={() => setShowBackupCodes(false)}
                        className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ya los guardé
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmación desactivar 2FA */}
                {showDisableConfirm && (
                  <div className="bg-red-50/30 border border-red-200 rounded-xl p-5 space-y-4">
                    <h4 className="font-medium text-red-700">Desactivar 2FA</h4>
                    <p className="text-sm text-red-600">
                      Ingresa tu contraseña actual para desactivar la autenticación de dos factores.
                    </p>
                    <div className="flex gap-2 max-w-sm">
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Contraseña actual"
                        className="flex-1 px-3 py-2.5 border border-red-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-shadow"
                      />
                      <button
                        onClick={handleDisable2fa}
                        disabled={twoFactorLoading || !disablePassword}
                        className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50 active:scale-95"
                      >
                        {twoFactorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Desactivar'}
                      </button>
                      <button
                        onClick={() => { setShowDisableConfirm(false); setDisablePassword(''); setDisableError(''); }}
                        className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                    {disableError && (
                      <p className="text-sm font-medium text-red-600">{disableError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Cerrar sesiones */}
              <div className="pt-6 mt-6 border-t border-gray-100 space-y-4">
                <h3 className="font-medium text-red-600 flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Sesiones Activas
                </h3>
                <button className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center gap-2 active:scale-95">
                  <LogOut className="w-4 h-4" /> Cerrar sesión en todos los dispositivos
                </button>
              </div>
            </div>
          )}

          {activeTab !== 'seguridad' && (
            <div className="pt-6 border-t border-gray-200 flex items-center gap-4">
              <button 
                onClick={handleSave}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition shadow-sm flex items-center gap-2 active:scale-95"
              >
                Guardar Cambios
              </button>
              {isSaved && (
                <span className="text-green-600 text-sm font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                  <CheckCircle2 className="w-4 h-4" /> Guardado correctamente en la Base de Datos
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
