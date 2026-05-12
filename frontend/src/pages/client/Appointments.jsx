import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import AppointmentCard from '../../components/AppointmentCard';
import api from '../../lib/api';

export default function ClientAppointments() {
  const { data } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
  });

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Mis citas</h1>
        <div className="space-y-4">
          {(data || []).map(a => (
            <Link key={a.id} to={`/app/appointments/${a.id}`}>
              <AppointmentCard appointment={a} />
            </Link>
          ))}
          {data?.length === 0 && <p className="text-nexo-gray-mid text-center py-16">No tienes citas aún.</p>}
        </div>
      </div>
    </div>
  );
}
