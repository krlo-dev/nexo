import { useQuery } from '@tanstack/react-query';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

export default function Stats() {
  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
  });

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me').then(r => r.data.data) });
  const { data: stores } = useQuery({ queryKey: ['my-stores'], queryFn: () => api.get('/stores').then(r => r.data.data), enabled: !!me });
  const store = stores?.find(s => s.owner_id === me?.id);

  const completed = (appointments || []).filter(a => a.status === 'completed');
  const totalRevenue = completed.reduce((sum, a) => sum + parseFloat(a.price || 0), 0);

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Estadísticas</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total citas', value: (appointments || []).length },
            { label: 'Completadas', value: completed.length },
            { label: 'Canceladas', value: (appointments || []).filter(a => a.status === 'cancelled').length },
            { label: 'Rating promedio', value: store ? `⭐ ${parseFloat(store.avg_rating || 0).toFixed(1)}` : '-' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-5 text-center">
              <p className="text-3xl font-bold text-nexo-red">{value}</p>
              <p className="text-sm text-nexo-gray-mid mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-5">
          <p className="text-sm text-nexo-gray-mid">Ingresos estimados</p>
          <p className="text-4xl font-bold text-nexo-black mt-1">COP {totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-nexo-gray-mid mt-1">Basado en {completed.length} citas completadas</p>
        </div>
      </div>
    </div>
  );
}
