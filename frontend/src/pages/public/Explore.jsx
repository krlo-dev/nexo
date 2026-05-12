import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '../../components/Navbar';
import StoreCard from '../../components/StoreCard';
import api from '../../lib/api';

export default function Explore() {
  const [params] = useSearchParams();
  const [category, setCategory] = useState(params.get('category') || '');
  const [city, setCity] = useState('');
  const [q, setQ] = useState(params.get('q') || '');

  const { data, isLoading } = useQuery({
    queryKey: ['stores', category, city, q],
    queryFn: () => {
      const p = new URLSearchParams();
      if (category) p.set('category', category);
      if (city) p.set('city', city);
      if (q) p.set('q', q);
      return api.get(`/stores?${p}`).then(r => r.data.data);
    },
  });

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Explorar tiendas</h1>

        <div className="flex gap-3 mb-6 flex-wrap">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="border border-nexo-border rounded-lg px-3 py-2 text-sm" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoría" className="border border-nexo-border rounded-lg px-3 py-2 text-sm" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad" className="border border-nexo-border rounded-lg px-3 py-2 text-sm" />
        </div>

        {isLoading && <p className="text-nexo-red">Cargando…</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(data || []).map((store) => <StoreCard key={store.id} store={store} />)}
        </div>
        {data?.length === 0 && <p className="text-nexo-gray-mid text-center py-16">No se encontraron tiendas.</p>}
      </div>
    </div>
  );
}
