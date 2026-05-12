import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

export default function AppointmentDetail() {
  const { id } = useParams();
  const qc = useQueryClient();

  const { data: apt } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.get('/appointments').then(r => r.data.data.find(a => a.id === id)),
  });

  const cancel = useMutation({
    mutationFn: () => api.delete(`/appointments/${id}`, { data: { cancel_reason: 'Cancelado por el cliente' } }),
    onSuccess: () => { toast.success('Cita cancelada'); qc.invalidateQueries(['appointments']); },
    onError: (err) => toast.error(err.response?.data?.error || 'No se pudo cancelar'),
  });

  if (!apt) return <div className="min-h-screen bg-nexo-gray-light"><Navbar /></div>;

  const canCancel = ['pending','confirmed'].includes(apt.status) &&
    new Date(apt.start_time) - new Date() > 2 * 60 * 60 * 1000;

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Detalle de cita</h1>
        <div className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-6 space-y-3">
          <p className="font-semibold text-lg">{apt.service_name}</p>
          <p className="text-nexo-gray-dark">{apt.store_name}</p>
          <p className="text-sm text-nexo-gray-mid">
            {format(new Date(apt.start_time), "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es })}
          </p>
          <p className="text-sm">Estado: <span className="font-medium text-nexo-red">{apt.status}</span></p>
          {apt.notes && <p className="text-sm text-nexo-gray-dark">Notas: {apt.notes}</p>}

          {canCancel && (
            <button
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
              className="mt-4 w-full border border-nexo-red text-nexo-red hover:bg-nexo-red-light rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {cancel.isPending ? 'Cancelando…' : 'Cancelar cita'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
