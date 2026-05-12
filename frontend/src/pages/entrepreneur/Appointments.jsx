import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import AppointmentCard from '../../components/AppointmentCard';
import api from '../../lib/api';

const STATUSES = ['todas', 'pending', 'confirmed', 'completed', 'cancelled'];

export default function EntrepreneurAppointments() {
  const [filter, setFilter] = useState('todas');
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/appointments/${id}/status`, { status }),
    onSuccess: () => { toast.success('Estado actualizado'); qc.invalidateQueries(['appointments']); },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  });

  const filtered = (data || []).filter(a => filter === 'todas' || a.status === filter);

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Citas agendadas</h1>

        <div className="flex gap-2 mb-6 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${filter === s ? 'bg-nexo-red text-white' : 'bg-white border border-nexo-border text-nexo-gray-dark hover:border-nexo-red'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filtered.map(a => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              actions={
                a.status === 'pending' ? (
                  <>
                    <button onClick={() => updateStatus.mutate({ id: a.id, status: 'confirmed' })} className="text-xs bg-nexo-red text-white px-3 py-1 rounded-lg">Confirmar</button>
                    <button onClick={() => updateStatus.mutate({ id: a.id, status: 'cancelled' })} className="text-xs border border-nexo-border px-3 py-1 rounded-lg text-nexo-gray-dark">Cancelar</button>
                  </>
                ) : a.status === 'confirmed' ? (
                  <button onClick={() => updateStatus.mutate({ id: a.id, status: 'completed' })} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg">Completar</button>
                ) : null
              }
            />
          ))}
          {filtered.length === 0 && <p className="text-nexo-gray-mid text-center py-12">Sin citas.</p>}
        </div>
      </div>
    </div>
  );
}
