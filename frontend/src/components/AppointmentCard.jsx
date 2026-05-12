import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_STYLES = {
  pending:     'bg-yellow-100 text-yellow-800',
  confirmed:   'bg-nexo-red-light text-nexo-red',
  completed:   'bg-green-100 text-green-800',
  cancelled:   'bg-gray-100 text-nexo-gray-mid',
  rescheduled: 'bg-blue-100 text-blue-800',
};

const STATUS_LABELS = {
  pending:     'Pendiente',
  confirmed:   'Confirmada',
  completed:   'Completada',
  cancelled:   'Cancelada',
  rescheduled: 'Reprogramada',
};

export default function AppointmentCard({ appointment, actions }) {
  const start = new Date(appointment.start_time);

  return (
    <div className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-nexo-black">{appointment.service_name || 'Servicio'}</p>
          <p className="text-sm text-nexo-gray-dark">{appointment.store_name || appointment.client_name}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[appointment.status]}`}>
          {STATUS_LABELS[appointment.status]}
        </span>
      </div>
      <p className="text-sm text-nexo-gray-mid">
        {format(start, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
      </p>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
