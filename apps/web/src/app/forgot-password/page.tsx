'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50/50">
      {/* Panel izquierdo decorativo */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0F172A] via-[#0E7490] to-[#06B6D4] relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-32 right-16 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center px-12 animate-in fade-in duration-700">
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <span className="text-3xl font-bold text-white">QJ</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">ANALISIS DE TESIS</h1>
          <p className="text-xl text-blue-200 mb-2">Recuperación de Acceso</p>
          <p className="text-sm text-blue-300/70 max-w-md mx-auto">
            No te preocupes. Ingresa tu correo y te facilitaremos un enlace seguro para restablecer tus credenciales al instante.
          </p>
        </div>
      </div>

      {/* Panel derecho formulario */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white relative">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-cyan-600 transition mb-6">
              <ArrowLeft className="w-4 h-4" /> Volver al login
            </Link>

            <div className="lg:hidden mb-6 flex justify-center">
              <div className="w-12 h-12 rounded-xl bg-cyan-600 flex items-center justify-center text-white font-bold text-xl">K</div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Recuperar contraseña</h2>
            <p className="text-sm text-gray-500">
              Ingresa tu correo institucional y te enviaremos las instrucciones de restablecimiento.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          {message && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-sm text-green-700 space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4 text-green-600" /> Solicitud Procesada
              </div>
              <p>{message}</p>
            </div>
          )}

          {!message && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico institucional</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                    placeholder="tu@universidad.edu"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center justify-center gap-2 active:scale-95"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Enviando instrucciones...
                  </>
                ) : 'Enviar enlace de recuperación'}
              </button>
            </form>
          )}

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              Modo desarrollo: el token de recuperación se muestra en la consola del servidor (terminal).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
