import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import AppointmentCard from '../../components/AppointmentCard';
import StoreCard from '../../components/StoreCard';
import api from '../../lib/api';

export default function ClientDashboard() {
  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.get('/recommendations?limit=4').then(r => r.data.data),
  });

  const upcoming = (appointments || []).filter(a => ['pending','confirmed'].includes(a.status)).slice(0, 3);

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Mi panel</h1>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Próximas citas</h2>
            <Link to="/app/appointments" className="text-sm text-nexo-red">Ver todas →</Link>
          </div>
          {upcoming.length === 0 && <p className="text-nexo-gray-mid text-sm">No tienes citas próximas. <Link to="/explore" className="text-nexo-red">Explora tiendas</Link></p>}
          <div className="space-y-3">
            {upcoming.map(a => <AppointmentCard key={a.id} appointment={a} />)}
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-4">✨ Recomendado para ti</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(recommendations || []).map(s => <StoreCard key={s.id} store={s} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
