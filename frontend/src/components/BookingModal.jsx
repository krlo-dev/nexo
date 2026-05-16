import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function BookingModal({ store, service, onClose }) {
  const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const qc = useQueryClient();

  const { data: slotsData } = useQuery({
    queryKey: ['slots', store.id, selectedDate, service.id],
    queryFn: () => api.get(`/stores/${store.id}/hours/availability?date=${selectedDate}&serviceId=${service.id}`).then(r => r.data.data),
  });

  const book = useMutation({
    mutationFn: () => api.post('/appointments', {
      service_id: service.id,
      store_id: store.id,
      start_time: `${selectedDate}T${selectedSlot}:00-05:00`,
      notes,
    }),
    onSuccess: () => {
      toast.success('¡Cita agendada!');
      qc.invalidateQueries({ queryKey: ['appointments'] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al agendar'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-nexo shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="font-bold text-lg text-nexo-black mb-1">Agendar cita</h2>
          <p className="text-nexo-gray-mid text-sm mb-4">{service.name} · {service.duration_minutes} min</p>

          <label className="block text-sm font-medium mb-1">Fecha</label>
          <input
            type="date"
            value={selectedDate}
            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
            className="w-full border border-nexo-border rounded-lg px-3 py-2 mb-4 text-sm"
          />

          <label className="block text-sm font-medium mb-2">Horario disponible</label>
          <div className="grid grid-cols-3 gap-2 mb-4 max-h-48 overflow-y-auto">
            {(slotsData || []).map((slot) => (
              <button
                key={slot.start}
                disabled={!slot.available}
                onClick={() => setSelectedSlot(slot.start)}
                className={`text-sm py-2 px-3 rounded-lg border transition-colors ${
                  !slot.available
                    ? 'bg-nexo-gray-light text-nexo-gray-mid cursor-not-allowed border-nexo-border'
                    : selectedSlot === slot.start
                    ? 'bg-nexo-red text-white border-nexo-red'
                    : 'border-nexo-red-mid text-nexo-red hover:bg-nexo-red-light'
                }`}
              >
                {slot.start}
              </button>
            ))}
            {slotsData?.length === 0 && <p className="col-span-3 text-nexo-gray-mid text-sm">Sin horarios disponibles</p>}
          </div>

          <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-nexo-border rounded-lg px-3 py-2 text-sm mb-4 resize-none"
          />

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-nexo-border rounded-lg py-2 text-sm text-nexo-gray-dark hover:bg-nexo-gray-light">
              Cancelar
            </button>
            <button
              disabled={!selectedSlot || book.isPending}
              onClick={() => book.mutate()}
              className="flex-1 bg-nexo-red hover:bg-nexo-red-dark disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold transition-colors"
            >
              {book.isPending ? 'Agendando…' : 'Confirmar cita'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
