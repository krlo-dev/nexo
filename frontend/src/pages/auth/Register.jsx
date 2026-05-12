import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { setToken } from '../../lib/auth';

const schema = z.object({
  full_name: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export default function Register() {
  const [role, setRole] = useState('cliente');
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    try {
      const res = await api.post('/auth/register', { ...data, role });
      setToken(res.data.data.token);
      navigate(role === 'emprendedor' ? '/dashboard' : '/app/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrarse');
    }
  };

  return (
    <div className="min-h-screen bg-nexo-gray-light flex items-center justify-center p-4">
      <div className="bg-white rounded-nexo shadow-nexo border border-nexo-border w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-nexo-red mb-1">Nexo</h1>
        <p className="text-nexo-gray-mid text-sm mb-6">Crea tu cuenta</p>

        <p className="text-sm font-medium mb-2">Soy…</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {['cliente', 'emprendedor'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`border rounded-lg py-3 text-sm font-medium transition-colors capitalize ${
                role === r ? 'border-nexo-red bg-nexo-red-light text-nexo-red' : 'border-nexo-border text-nexo-gray-dark hover:bg-nexo-gray-light'
              }`}
            >
              {r === 'cliente' ? '👤 Cliente' : '🏪 Emprendedor'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre completo</label>
            <input {...register('full_name')} className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm" />
            {errors.full_name && <p className="text-nexo-red text-xs mt-1">{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input {...register('email')} type="email" className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm" />
            {errors.email && <p className="text-nexo-red text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input {...register('password')} type="password" className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm" />
            {errors.password && <p className="text-nexo-red text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-nexo-red hover:bg-nexo-red-dark text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-nexo-gray-mid mt-4">
          ¿Ya tienes cuenta? <Link to="/auth/login" className="text-nexo-red font-medium">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
