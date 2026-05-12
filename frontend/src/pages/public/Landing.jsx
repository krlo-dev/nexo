import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '../../components/Navbar';
import StoreCard from '../../components/StoreCard';
import api from '../../lib/api';
import { getUser } from '../../lib/auth';

const CATEGORIES = ['Belleza', 'Salud', 'Tecnología', 'Fitness', 'Educación', 'Hogar', 'Mascotas', 'Otros'];

export default function Landing() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const user = getUser();

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.get('/recommendations?limit=6').then(r => r.data.data),
    enabled: !!user,
  });

  const { data: featured } = useQuery({
    queryKey: ['stores-featured'],
    queryFn: () => api.get('/stores?limit=6').then(r => r.data.data),
    enabled: !user,
  });

  const stores = recommendations || featured || [];

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />

      {/* Hero */}
      <section className="bg-white border-b border-nexo-border py-16 px-4 text-center">
        <h1 className="text-4xl font-bold text-nexo-black mb-3">
          Agenda citas con los mejores<br />
          <span className="text-nexo-red">negocios locales</span>
        </h1>
        <p className="text-nexo-gray-dark mb-8 max-w-md mx-auto">Conecta con emprendedores, reserva en segundos y lleva el control de tus citas.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); navigate(`/explore?q=${search}`); }}
          className="flex gap-2 max-w-md mx-auto"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="¿Qué servicio buscas?"
            className="flex-1 border border-nexo-border rounded-lg px-4 py-2.5 text-sm focus:outline-nexo-red"
          />
          <button type="submit" className="bg-nexo-red hover:bg-nexo-red-dark text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
            Buscar
          </button>
        </form>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="font-bold text-lg mb-4">Categorías populares</h2>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => navigate(`/explore?category=${cat.toLowerCase()}`)}
              className="bg-white rounded-nexo border border-nexo-border p-3 text-center hover:border-nexo-red hover:shadow-nexo transition-all"
            >
              <p className="text-xs font-medium text-nexo-gray-dark">{cat}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Recommendations / Featured */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="font-bold text-lg mb-4">
          {user ? '✨ Recomendado para ti' : '⭐ Tiendas destacadas'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stores.map((store) => <StoreCard key={store.id} store={store} />)}
        </div>
      </section>
    </div>
  );
}
