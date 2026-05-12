import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

export default function AdminUsers() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/admin/users').then(r => r.data.data) });

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => { toast.success('Rol actualizado'); qc.invalidateQueries(['admin-users']); },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  });

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Usuarios</h1>
        <div className="bg-white rounded-nexo border border-nexo-border shadow-nexo overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nexo-gray-light text-nexo-gray-dark">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map(u => (
                <tr key={u.id} className="border-t border-nexo-border">
                  <td className="px-4 py-3">{u.full_name}</td>
                  <td className="px-4 py-3 text-nexo-gray-mid">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-nexo-red-light text-nexo-red' : 'bg-nexo-gray-light text-nexo-gray-dark'}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                      className="border border-nexo-border rounded px-2 py-1 text-xs"
                    >
                      <option value="cliente">cliente</option>
                      <option value="emprendedor">emprendedor</option>
                      <option value="admin">admin</option>
                    </select>
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
