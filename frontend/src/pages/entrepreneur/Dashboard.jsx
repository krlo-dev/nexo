import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import AppointmentCard from '../../components/AppointmentCard';
import api from '../../lib/api';
import { format } from 'date-fns';

export default function EntrepreneurDashboard() {
  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayApts = (appointments || []).filter(a =>
    a.start_time?.startsWith(today) && a.status !== 'cancelled'
  );

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Panel del emprendedor</h1>
          <Link to="/dashboard/store" className="text-sm text-nexo-red">Ver mi tienda →</Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Citas hoy', value: todayApts.length },
            { label: 'Pendientes', value: (appointments || []).filter(a => a.status === 'pending').length },
            { label: 'Confirmadas', value: (appointments || []).filter(a => a.status === 'confirmed').length },
            { label: 'Completadas', value: (appointments || []).filter(a => a.status === 'completed').length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-4 text-center">
              <p className="text-3xl font-bold text-nexo-red">{value}</p>
              <p className="text-sm text-nexo-gray-mid">{label}</p>
            </div>
          ))}
        </div>

        <h2 className="font-semibold text-lg mb-4">Citas de hoy</h2>
        <div className="space-y-3">
          {todayApts.map(a => <AppointmentCard key={a.id} appointment={a} />)}
          {todayApts.length === 0 && <p className="text-nexo-gray-mid text-sm">Sin citas para hoy.</p>}
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { to: '/dashboard/appointments', label: 'Todas las citas' },
            { to: '/dashboard/services', label: 'Mis servicios' },
            { to: '/dashboard/hours', label: 'Horarios' },
            { to: '/dashboard/store/edit', label: 'Editar tienda' },
            { to: '/dashboard/stats', label: 'Estadísticas' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-4 text-sm font-medium text-nexo-gray-dark hover:border-nexo-red hover:text-nexo-red transition-colors text-center">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
