import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

export default function StoreView() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me').then(r => r.data.data) });
  const { data: stores } = useQuery({
    queryKey: ['my-stores'],
    queryFn: () => api.get('/stores').then(r => r.data.data),
    enabled: !!me,
  });

  const store = stores?.find(s => s.owner_id === me?.id);

  if (!store) return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-nexo-gray-mid mb-4">Aún no tienes una tienda.</p>
        <Link to="/dashboard/store/edit" className="bg-nexo-red text-white px-6 py-2 rounded-lg text-sm font-semibold">Crear tienda</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <Link to="/dashboard/store/edit" className="bg-nexo-red text-white px-4 py-2 rounded-lg text-sm font-semibold">Editar</Link>
        </div>
        <div className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-6 space-y-2">
          <p className="text-sm"><span className="font-medium">Categoría:</span> {store.category}</p>
          <p className="text-sm"><span className="font-medium">Ciudad:</span> {store.city}</p>
          <p className="text-sm"><span className="font-medium">Dirección:</span> {store.address}</p>
          <p className="text-sm"><span className="font-medium">Rating:</span> ⭐ {parseFloat(store.avg_rating || 0).toFixed(1)} ({store.total_reviews} reseñas)</p>
          <p className="text-sm text-nexo-gray-dark mt-2">{store.description}</p>
        </div>
      </div>
    </div>
  );
}
