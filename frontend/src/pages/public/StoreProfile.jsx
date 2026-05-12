import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '../../components/Navbar';
import BookingModal from '../../components/BookingModal';
import api from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function StoreProfile() {
  const { slug } = useParams();
  const [tab, setTab] = useState('servicios');
  const [booking, setBooking] = useState(null);
  const user = getUser();

  const { data, isLoading } = useQuery({
    queryKey: ['store', slug],
    queryFn: () => api.get(`/stores/${slug}`).then(r => r.data.data),
  });

  if (isLoading) return <div className="min-h-screen bg-nexo-gray-light"><Navbar /><p className="text-center py-16 text-nexo-red">Cargando…</p></div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />

      <div
        className="h-48 bg-nexo-red-light bg-cover bg-center"
        style={data.banner_url ? { backgroundImage: `url(${data.banner_url})` } : {}}
      />

      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div
            className="w-20 h-20 rounded-full border-4 border-nexo-red bg-nexo-red-light flex-shrink-0 bg-cover bg-center"
            style={data.avatar_url ? { backgroundImage: `url(${data.avatar_url})` } : {}}
          />
          <div className="pb-2">
            <h1 className="text-xl font-bold text-nexo-black">{data.name}</h1>
            <span className="text-xs font-medium text-nexo-red bg-nexo-red-light px-2 py-0.5 rounded-full">{data.category}</span>
          </div>
        </div>

        <p className="text-nexo-gray-dark mb-2">{data.description}</p>
        <p className="text-sm text-nexo-gray-mid mb-1">📍 {data.address}, {data.city}</p>
        {data.phone && <p className="text-sm text-nexo-gray-mid mb-1">📞 {data.phone}</p>}
        <p className="text-sm mb-6">⭐ {parseFloat(data.avg_rating || 0).toFixed(1)} ({data.total_reviews} reseñas)</p>

        <div className="flex border-b border-nexo-border mb-6">
          {['servicios', 'reseñas'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-nexo-red text-nexo-red' : 'border-transparent text-nexo-gray-mid'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'servicios' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
            {(data.services || []).map((svc) => (
              <div key={svc.id} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-4">
                <h3 className="font-semibold text-nexo-black">{svc.name}</h3>
                <p className="text-sm text-nexo-gray-mid mb-3">{svc.duration_minutes} min · {svc.currency} {svc.price}</p>
                {user?.role === 'cliente' && (
                  <button
                    onClick={() => setBooking(svc)}
                    className="w-full bg-nexo-red hover:bg-nexo-red-dark text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                  >
                    Agendar
                  </button>
                )}
                {!user && (
                  <a href="/auth/login" className="block w-full text-center bg-nexo-red hover:bg-nexo-red-dark text-white text-sm font-semibold rounded-lg py-2 transition-colors">
                    Iniciar sesión para agendar
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'reseñas' && (
          <div className="space-y-4 pb-16">
            {(data.reviews || []).map((r) => (
              <div key={r.id} className="bg-white rounded-nexo border border-nexo-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{r.full_name}</span>
                  <span className="text-nexo-red text-sm">{'⭐'.repeat(r.rating)}</span>
                </div>
                <p className="text-sm text-nexo-gray-dark">{r.comment}</p>
              </div>
            ))}
            {data.reviews?.length === 0 && <p className="text-nexo-gray-mid text-center py-8">Aún no hay reseñas.</p>}
          </div>
        )}
      </div>

      {booking && <BookingModal store={data} service={booking} onClose={() => setBooking(null)} />}
    </div>
  );
}
