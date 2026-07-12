'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Lock, Eye, EyeOff, CheckCircle, ArrowRight, XCircle } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Token de recuperación no encontrado o inválido.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Token inválido o expirado. Vuelve a solicitar la recuperación.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Enlace Inválido</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Este enlace de recuperación de contraseña carece de un token de validación válido. Por favor, solicita uno nuevo.
        </p>
        <div className="pt-4">
          <Link href="/forgot-password" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg shadow-sm transition active:scale-95 inline-block">
            Solicitar Nueva Recuperación
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-5 animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">¡Contraseña Restablecida!</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tu nueva contraseña ha sido actualizada con éxito en la base de datos de KIMY.
          </p>
        </div>
        <div className="pt-4">
          <Link 
            href="/login" 
            className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 active:scale-95"
          >
            Iniciar Sesión con Nueva Contraseña <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">Nueva Contraseña</h2>
        <p className="text-sm text-gray-500">
          Ingresa y confirma tu nueva contraseña de acceso.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 animate-in fade-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva Contraseña</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
              placeholder="Mínimo 6 caracteres"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar Nueva Contraseña</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
              placeholder="Repite la contraseña"
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
              Actualizando contraseña...
            </>
          ) : 'Restablecer Contraseña'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
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
            <span className="text-3xl font-bold text-white">K</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">KIMY</h1>
          <p className="text-xl text-blue-200 mb-2">Restablecer Credenciales</p>
          <p className="text-sm text-blue-300/70 max-w-md mx-auto">
            Por favor, define una contraseña segura. Te recomendamos combinar letras mayúsculas, minúsculas, números y caracteres especiales.
          </p>
        </div>
      </div>

      {/* Panel derecho formulario */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6 flex justify-center">
            <div className="w-12 h-12 rounded-xl bg-cyan-600 flex items-center justify-center text-white font-bold text-xl">K</div>
          </div>
          
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center gap-3">
              <span className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></span>
              <p className="text-sm text-gray-500">Cargando formulario...</p>
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
