import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

export default function StoreEdit() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me').then(r => r.data.data) });
  const { data: stores } = useQuery({
    queryKey: ['my-stores'],
    queryFn: () => api.get('/stores').then(r => r.data.data),
    enabled: !!me,
  });

  const store = stores?.find(s => s.owner_id === me?.id);

  useEffect(() => { if (store) reset(store); }, [store]);

  const save = useMutation({
    mutationFn: (data) => store
      ? api.put(`/stores/${store.id}`, data)
      : api.post('/stores', data),
    onSuccess: () => {
      toast.success('Tienda guardada');
      qc.invalidateQueries(['my-stores']);
      navigate('/dashboard/store');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al guardar'),
  });

  const fields = [
    { name: 'name', label: 'Nombre' },
    { name: 'category', label: 'Categoría' },
    { name: 'description', label: 'Descripción', textarea: true },
    { name: 'city', label: 'Ciudad' },
    { name: 'address', label: 'Dirección' },
    { name: 'phone', label: 'Teléfono' },
    { name: 'instagram_handle', label: 'Instagram' },
  ];

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">{store ? 'Editar tienda' : 'Crear tienda'}</h1>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-6 space-y-4">
          {fields.map(({ name, label, textarea }) => (
            <div key={name}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              {textarea
                ? <textarea {...register(name)} rows={3} className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm resize-none" />
                : <input {...register(name)} className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm" />
              }
            </div>
          ))}
          <button
            type="submit"
            disabled={save.isPending}
            className="w-full bg-nexo-red hover:bg-nexo-red-dark text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {save.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
