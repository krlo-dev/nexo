import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { setToken } from '../../lib/auth';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export default function Login() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    try {
      const res = await api.post('/auth/login', data);
      setToken(res.data.data.token);
      const role = res.data.data.user.role;
      navigate(role === 'emprendedor' ? '/dashboard' : role === 'admin' ? '/admin' : '/app/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-nexo-gray-light flex items-center justify-center p-4">
      <div className="bg-white rounded-nexo shadow-nexo border border-nexo-border w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-nexo-red mb-1">Nexo</h1>
        <p className="text-nexo-gray-mid text-sm mb-6">Inicia sesión en tu cuenta</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input {...register('email')} type="email" className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm focus:outline-nexo-red" />
            {errors.email && <p className="text-nexo-red text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input {...register('password')} type="password" className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm focus:outline-nexo-red" />
            {errors.password && <p className="text-nexo-red text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-nexo-red hover:bg-nexo-red-dark text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-sm text-nexo-gray-mid mt-4">
          ¿No tienes cuenta? <Link to="/auth/register" className="text-nexo-red font-medium">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
