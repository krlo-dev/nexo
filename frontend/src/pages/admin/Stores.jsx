import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

export default function AdminStores() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-stores'], queryFn: () => api.get('/admin/stores').then(r => r.data.data) });

  const toggle = useMutation({
    mutationFn: (id) => api.patch(`/admin/stores/${id}/active`),
    onSuccess: () => { toast.success('Estado actualizado'); qc.invalidateQueries(['admin-stores']); },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  });

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Tiendas</h1>
        <div className="bg-white rounded-nexo border border-nexo-border shadow-nexo overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nexo-gray-light text-nexo-gray-dark">
              <tr>
                <th className="px-4 py-3 text-left">Tienda</th>
                <th className="px-4 py-3 text-left">Dueño</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map(s => (
                <tr key={s.id} className="border-t border-nexo-border">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-nexo-gray-mid">{s.owner_name}</td>
                  <td className="px-4 py-3">{s.category}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-nexo-gray-mid'}`}>
                      {s.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle.mutate(s.id)} className={`text-xs px-3 py-1 rounded-lg font-medium ${s.is_active ? 'border border-nexo-border text-nexo-gray-dark hover:bg-nexo-gray-light' : 'bg-nexo-red text-white hover:bg-nexo-red-dark'}`}>
                      {s.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
