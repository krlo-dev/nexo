import { Link } from 'react-router-dom';

export default function StoreCard({ store }) {
  return (
    <div className="bg-white rounded-nexo shadow-nexo border border-nexo-border overflow-hidden hover:shadow-lg transition-shadow">
      <div
        className="h-32 bg-nexo-red-light bg-cover bg-center"
        style={store.banner_url ? { backgroundImage: `url(${store.banner_url})` } : {}}
      />
      <div className="px-4 pb-4">
        <div className="flex items-end gap-3 -mt-8 mb-3">
          <div
            className="w-16 h-16 rounded-full border-2 border-nexo-red bg-nexo-red-light bg-cover bg-center flex-shrink-0"
            style={store.avatar_url ? { backgroundImage: `url(${store.avatar_url})` } : {}}
          />
        </div>
        <h3 className="font-semibold text-nexo-black">{store.name}</h3>
        <span className="inline-block text-xs font-medium text-nexo-red bg-nexo-red-light px-2 py-0.5 rounded-full mb-1">
          {store.category}
        </span>
        <p className="text-sm text-nexo-gray-mid line-clamp-2">{store.description}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-nexo-gray-dark">⭐ {parseFloat(store.avg_rating || 0).toFixed(1)} · {store.city}</span>
          <Link
            to={`/store/${store.slug}`}
            className="text-sm font-semibold text-nexo-red hover:text-nexo-red-dark"
          >
            Ver tienda →
          </Link>
        </div>
      </div>
    </div>
  );
}
