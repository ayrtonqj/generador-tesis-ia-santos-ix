'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ShieldAlert, Sparkles, Database, CheckCircle, Smartphone, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados 2FA
  const [requires2fa, setRequires2fa] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.requires2fa) {
        setTempToken(res.data.tempToken);
        setRequires2fa(true);
        setTimeout(() => codeInputRef.current?.focus(), 100);
        return;
      }
      Cookies.set('kimy_token', res.data.accessToken, { expires: 7 });
      Cookies.set('kimy_user', JSON.stringify(res.data.user), { expires: 7 });
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError('');
    setTwoFactorLoading(true);

    try {
      const res = await api.post('/auth/2fa/authenticate', {
        tempToken,
        code: twoFactorCode,
      });
      Cookies.set('kimy_token', res.data.accessToken, { expires: 7 });
      Cookies.set('kimy_user', JSON.stringify(res.data.user), { expires: 7 });
      window.location.href = '/dashboard';
    } catch (err: any) {
      setTwoFactorError(err.response?.data?.message || 'Código inválido. Intenta de nuevo.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequires2fa(false);
    setTempToken('');
    setTwoFactorCode('');
    setTwoFactorError('');
  };

  return (
    <div className="min-h-screen flex bg-slate-50/50">
      {/* Panel izquierdo - decorativo premium */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0B132B] via-[#0E7490] to-[#0891B2] relative overflow-hidden items-center justify-center">
        {/* Mesh gradients y luces radiales de fondo */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-cyan-400 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500 rounded-full blur-[140px]"></div>
        </div>

        {/* Patrón de líneas sutil de fondo */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        <div className="relative z-10 text-center px-16 max-w-xl">
          {/* Logo con efecto Glassmorphism */}
          <div className="w-24 h-24 mx-auto mb-10 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl shadow-cyan-500/10 transition-transform duration-500 hover:scale-105">
            <span className="text-4xl font-extrabold text-white tracking-wider filter drop-shadow-md">QJ</span>
          </div>

          <h1 className="text-5xl font-black text-white tracking-tight mb-4 drop-shadow-sm">
            ANALISIS DE TESIS
          </h1>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" /> IA & Analítica Universitaria
          </div>

          <p className="text-lg text-cyan-100/90 leading-relaxed font-light mb-12">
            Plataforma de evaluación inteligente de avances de tesis universitarias.
            Retroalimentación interactiva y rigurosa impulsada por modelos avanzados de lenguaje.
          </p>

          {/* Estadísticas flotantes como tarjetas */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:bg-white/10 flex flex-col justify-between min-h-[110px]">
              <Sparkles className="w-5 h-5 text-cyan-300 mx-auto mb-2" />
              <div className="text-[11px] font-black text-white leading-tight uppercase tracking-wider">
                GPT-4o • GEMINI • GROQ
              </div>
              <div className="text-[10px] text-cyan-200/60 font-medium uppercase tracking-wider mt-1.5">Modelos Híbridos</div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:bg-white/10 flex flex-col justify-between min-h-[110px]">
              <CheckCircle className="w-5 h-5 text-emerald-300 mx-auto mb-2" />
              <div className="text-xl font-bold text-white leading-none">100%</div>
              <div className="text-[10px] text-cyan-200/60 font-medium uppercase tracking-wider mt-1.5">Trazabilidad</div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 transition-all duration-300 hover:bg-white/10 flex flex-col justify-between min-h-[110px]">
              <Database className="w-5 h-5 text-amber-300 mx-auto mb-2" />
              <div className="text-xl font-bold text-white leading-none">CrossRef</div>
              <div className="text-[10px] text-cyan-200/60 font-medium uppercase tracking-wider mt-1.5">Citas e Imprenta</div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho - formulario interactivo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-12 bg-white relative">
        <div className="w-full max-w-md space-y-7">
          {/* Cabecera para dispositivos móviles */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-600/20">
              <span className="text-3xl font-extrabold text-white">K</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">KIMY</h1>
            <p className="text-xs text-slate-500 mt-1">Revisión Inteligente de Tesis</p>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Bienvenido</h2>
            <p className="text-sm text-slate-500 mt-1.5">Ingresa tus credenciales institucionales para iniciar</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">Acceso Denegado: </span>
                {error}
              </div>
            </div>
          )}

          {requires2fa ? (
            <form onSubmit={handleTwoFactorSubmit} className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3 mb-2">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Autenticación en Dos Pasos</h3>
                  <p className="text-sm text-slate-500">Ingresa el código de 6 dígitos desde tu app de autenticación</p>
                </div>
              </div>

              {twoFactorError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700 flex items-start gap-2.5 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Código Inválido: </span>
                    {twoFactorError}
                  </div>
                </div>
              )}

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center">
                  <Smartphone className="w-7 h-7 text-cyan-600" />
                </div>
                <div className="flex justify-center gap-2 mb-4">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all ${
                        twoFactorCode.length > i
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-slate-200 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {twoFactorCode[i] || ''}
                    </div>
                  ))}
                </div>
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 text-slate-800 text-lg text-center font-mono tracking-[0.5em] focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all bg-slate-50/50"
                  placeholder="••••••"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={twoFactorLoading || twoFactorCode.length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg shadow-cyan-600/10 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {twoFactorLoading ? (
                  <>
                    <span className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Verificando código...
                  </>
                ) : 'Verificar código'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Correo electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50"
                    placeholder="nombre@universidad.edu.pe"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Contraseña</label>
                  <Link href="/forgot-password" className="text-xs font-bold text-cyan-600 hover:text-cyan-700 transition-colors">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg shadow-cyan-600/10 active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Ingresando al sistema...
                  </>
                ) : 'Iniciar sesión'}
              </button>
            </form>
          )}

          {/* Consola de Credenciales de Prueba Rediseñada */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Entornos de Simulación</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            <div className="space-y-2 text-xs font-medium text-slate-600">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 rounded-lg bg-white border border-slate-200/40 gap-1 shadow-sm">
                <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold uppercase">Admin</span>
                <code className="font-mono text-slate-800 text-[11px] select-all">admin@kimy.edu</code>
                <span className="text-[10px] text-slate-400 font-mono">Kimy2026!</span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 rounded-lg bg-white border border-slate-200/40 gap-1 shadow-sm">
                <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold uppercase">Coord</span>
                <code className="font-mono text-slate-800 text-[11px] select-all">coordinador@kimy.edu</code>
                <span className="text-[10px] text-slate-400 font-mono">Kimy2026!</span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 rounded-lg bg-white border border-slate-200/40 gap-1 shadow-sm">
                <span className="px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-100 text-cyan-700 text-[10px] font-bold uppercase">Asesor</span>
                <code className="font-mono text-slate-800 text-[11px] select-all">asesor1@kimy.edu</code>
                <span className="text-[10px] text-slate-400 font-mono">Kimy2026!</span>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 rounded-lg bg-white border border-slate-200/40 gap-1 shadow-sm">
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase">Estud</span>
                <code className="font-mono text-slate-800 text-[11px] select-all">estudiante1@kimy.edu</code>
                <span className="text-[10px] text-slate-400 font-mono">Kimy2026!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
