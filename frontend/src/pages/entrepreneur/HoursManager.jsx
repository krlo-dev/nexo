import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

export default function HoursManager() {
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me').then(r => r.data.data) });
  const { data: stores } = useQuery({ queryKey: ['my-stores'], queryFn: () => api.get('/stores').then(r => r.data.data), enabled: !!me });
  const store = stores?.find(s => s.owner_id === me?.id);

  const { data: hours } = useQuery({
    queryKey: ['hours', store?.id],
    queryFn: () => api.get(`/stores/${store.id}/hours`).then(r => r.data.data),
    enabled: !!store,
  });

  useEffect(() => {
    if (hours) {
      const defaults = {};
      DAYS.forEach((_, i) => {
        const h = hours.find(h => h.day_of_week === i) || { open_time: '09:00', close_time: '18:00', is_open: true };
        defaults[`day_${i}_open`] = h.open_time?.slice(0, 5);
        defaults[`day_${i}_close`] = h.close_time?.slice(0, 5);
        defaults[`day_${i}_is_open`] = h.is_open;
      });
      reset(defaults);
    }
  }, [hours]);

  const save = useMutation({
    mutationFn: (data) => {
      const payload = DAYS.map((_, i) => ({
        day_of_week: i,
        open_time: data[`day_${i}_open`],
        close_time: data[`day_${i}_close`],
        is_open: !!data[`day_${i}_is_open`],
      }));
      return api.put(`/stores/${store.id}/hours`, payload);
    },
    onSuccess: () => { toast.success('Horarios guardados'); qc.invalidateQueries(['hours']); },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  });

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Horarios de atención</h1>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-6 space-y-4">
          {DAYS.map((day, i) => (
            <div key={i} className="flex items-center gap-4">
              <input type="checkbox" {...register(`day_${i}_is_open`)} className="accent-nexo-red" />
              <span className="w-24 text-sm font-medium">{day}</span>
              <input type="time" {...register(`day_${i}_open`)} className="border border-nexo-border rounded px-2 py-1 text-sm" />
              <span className="text-nexo-gray-mid text-sm">–</span>
              <input type="time" {...register(`day_${i}_close`)} className="border border-nexo-border rounded px-2 py-1 text-sm" />
            </div>
          ))}
          <button type="submit" disabled={save.isPending} className="w-full bg-nexo-red hover:bg-nexo-red-dark text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 mt-2">
            {save.isPending ? 'Guardando…' : 'Guardar horarios'}
          </button>
        </form>
      </div>
    </div>
  );
}
