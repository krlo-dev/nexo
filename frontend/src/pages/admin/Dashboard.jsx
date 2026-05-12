import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

export default function AdminDashboard() {
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/admin/users').then(r => r.data.data) });
  const { data: stores } = useQuery({ queryKey: ['admin-stores'], queryFn: () => api.get('/admin/stores').then(r => r.data.data) });

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Panel de administración</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Usuarios', value: users?.length || 0 },
            { label: 'Tiendas activas', value: stores?.filter(s => s.is_active).length || 0 },
            { label: 'Emprendedores', value: users?.filter(u => u.role === 'emprendedor').length || 0 },
            { label: 'Clientes', value: users?.filter(u => u.role === 'cliente').length || 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-5 text-center">
              <p className="text-3xl font-bold text-nexo-red">{value}</p>
              <p className="text-sm text-nexo-gray-mid">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link to="/admin/users" className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-5 text-center font-medium hover:border-nexo-red transition-colors">Gestionar usuarios</Link>
          <Link to="/admin/stores" className="bg-white rounded-nexo border border-nexo-border shadow-nexo p-5 text-center font-medium hover:border-nexo-red transition-colors">Gestionar tiendas</Link>
        </div>
      </div>
    </div>
  );
}
