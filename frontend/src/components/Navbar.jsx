import { Link, useNavigate } from 'react-router-dom';
import { getUser, clearToken } from '../lib/auth';

export default function Navbar() {
  const user = getUser();
  const navigate = useNavigate();

  const logout = () => { clearToken(); navigate('/'); };

  const dashboardLink = user?.role === 'emprendedor'
    ? '/dashboard'
    : user?.role === 'admin'
    ? '/admin'
    : '/app/dashboard';

  return (
    <nav className="bg-white border-b border-nexo-border shadow-nexo sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-nexo-red font-bold text-xl tracking-tight">Nexo</Link>

        <div className="flex items-center gap-4">
          <Link to="/explore" className="text-nexo-gray-dark hover:text-nexo-red text-sm font-medium">Explorar</Link>

          {user ? (
            <>
              <Link to={dashboardLink} className="text-nexo-gray-dark hover:text-nexo-red text-sm font-medium">Mi cuenta</Link>
              <button onClick={logout} className="text-sm text-nexo-gray-mid hover:text-nexo-red">Salir</button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="text-sm font-medium text-nexo-gray-dark hover:text-nexo-red">Iniciar sesión</Link>
              <Link to="/auth/register" className="bg-nexo-red hover:bg-nexo-red-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Registrarse</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
