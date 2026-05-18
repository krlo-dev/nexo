import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

export default function ServicesManager() {
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me').then(r => r.data.data) });
  const { data: stores } = useQuery({ queryKey: ['my-stores'], queryFn: () => api.get('/stores').then(r => r.data.data), enabled: !!me });
  const store = stores?.find(s => s.owner_id === me?.id);


  const { data: services } = useQuery({
    queryKey: ['services', store?.id],
    queryFn: () => api.get(`/stores/${store.id}/services`).then(r => r.data.data),
    enabled: !!store,
  });

  const save = useMutation({
    mutationFn: (data) => editing?.id
      ? api.put(`/stores/${store.id}/services/${editing.id}`, data)
      : api.post(`/stores/${store.id}/services`, data),
    onSuccess: () => { toast.success('Servicio guardado'); qc.invalidateQueries(['services']); reset(); setEditing(null); },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/stores/${store.id}/services/${id}`),
    onSuccess: () => { toast.success('Servicio eliminado'); qc.invalidateQueries(['services']); },
  });

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Mis servicios</h1>

        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-5 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Nombre</label>
            <input {...register('name')} className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Duración (min)</label>
            <input {...register('duration_minutes')} type="number" className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Precio</label>
            <input {...register('price')} type="number" step="0.01" className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Moneda</label>
            <input {...register('currency')} defaultValue="COP" className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Descripción</label>
            <textarea {...register('description')} rows={2} className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm mt-1 resize-none" />
          </div>
          <div className="col-span-2 flex gap-3">
            <button type="submit" disabled={save.isPending} className="bg-nexo-red text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {save.isPending ? 'Guardando…' : editing ? 'Actualizar' : 'Agregar servicio'}
            </button>
            {editing && <button type="button" onClick={() => { setEditing(null); reset(); }} className="text-sm text-nexo-gray-mid">Cancelar</button>}
          </div>
        </form>

        <div className="space-y-3">
          {(services || []).map((s) => (
            <div key={s.id} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-nexo-gray-mid">{s.duration_minutes} min · {s.currency} {s.price}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(s); reset(s); }} className="text-sm text-nexo-red hover:underline">Editar</button>
                <button onClick={() => remove.mutate(s.id)} className="text-sm text-nexo-gray-mid hover:text-red-600">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
