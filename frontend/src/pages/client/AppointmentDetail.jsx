import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatAppointmentDateFull } from '../../lib/date';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userId = getUser()?.id;

  // Misma queryKey que la lista — si la lista se invalida, el detalle también se actualiza
  const { data: allApts } = useQuery({
    queryKey: ['appointments', userId],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
  });
  const apt = allApts?.find(a => a.id === id);

  const cancel = useMutation({
    mutationFn: () => api.delete(`/appointments/${id}`, { data: { cancel_reason: 'Cancelado por el cliente' } }),
    onSuccess: () => {
      toast.success('Cita cancelada');
      qc.invalidateQueries({ queryKey: ['appointments'] });
      navigate('/app/appointments');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'No se pudo cancelar'),
  });

  if (!apt) return <div className="min-h-screen bg-nexo-gray-light"><Navbar /></div>;

  const canCancel = ['pending', 'confirmed'].includes(apt.status) &&
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
            {formatAppointmentDateFull(apt.start_time)}
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
