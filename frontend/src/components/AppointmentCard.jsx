import { formatAppointmentDate } from '../lib/date';

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

export default function AppointmentCard({ appointment, actions, onDismiss }) {
  return (
    <div className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-4 relative">
      {onDismiss && (
        <button
          onClick={(e) => { e.preventDefault(); onDismiss(appointment.id); }}
          title="Quitar de la lista"
          className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full text-nexo-gray-mid hover:bg-gray-100 hover:text-nexo-black transition-colors text-xs leading-none"
        >
          ✕
        </button>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-nexo-black">{appointment.service_name || 'Servicio'}</p>
          <p className="text-sm text-nexo-gray-dark">{appointment.store_name || appointment.client_name}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${onDismiss ? 'mr-5' : ''} ${STATUS_STYLES[appointment.status]}`}>
          {STATUS_LABELS[appointment.status]}
        </span>
      </div>
      <p className="text-sm text-nexo-gray-mid">
        {formatAppointmentDate(appointment.start_time)}
      </p>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
