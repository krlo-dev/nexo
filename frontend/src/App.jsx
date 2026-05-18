import { Routes, Route, Navigate } from 'react-router-dom';
import { getUser } from './lib/auth';
import AgentChat from './components/AgentChat';

// Public
import Landing from './pages/public/Landing';
import Explore from './pages/public/Explore';
import StoreProfile from './pages/public/StoreProfile';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Client
import ClientDashboard from './pages/client/Dashboard';
import ClientAppointments from './pages/client/Appointments';
import AppointmentDetail from './pages/client/AppointmentDetail';

// Entrepreneur
import EntrepreneurDashboard from './pages/entrepreneur/Dashboard';
import StoreView from './pages/entrepreneur/StoreView';
import StoreEdit from './pages/entrepreneur/StoreEdit';
import ServicesManager from './pages/entrepreneur/ServicesManager';
import HoursManager from './pages/entrepreneur/HoursManager';
import EntrepreneurAppointments from './pages/entrepreneur/Appointments';
import Stats from './pages/entrepreneur/Stats';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminStores from './pages/admin/Stores';

const ProtectedRoute = ({ children, roles }) => {
  const user = getUser();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <>
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/store/:slug" element={<StoreProfile />} />
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />

      {/* Client */}
      <Route path="/app/dashboard" element={<ProtectedRoute roles={['cliente']}><ClientDashboard /></ProtectedRoute>} />
      <Route path="/app/appointments" element={<ProtectedRoute roles={['cliente']}><ClientAppointments /></ProtectedRoute>} />
      <Route path="/app/appointments/:id" element={<ProtectedRoute roles={['cliente']}><AppointmentDetail /></ProtectedRoute>} />

      {/* Entrepreneur */}
      <Route path="/dashboard" element={<ProtectedRoute roles={['emprendedor']}><EntrepreneurDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/store" element={<ProtectedRoute roles={['emprendedor']}><StoreView /></ProtectedRoute>} />
      <Route path="/dashboard/store/edit" element={<ProtectedRoute roles={['emprendedor']}><StoreEdit /></ProtectedRoute>} />
      <Route path="/dashboard/services" element={<ProtectedRoute roles={['emprendedor']}><ServicesManager /></ProtectedRoute>} />
      <Route path="/dashboard/hours" element={<ProtectedRoute roles={['emprendedor']}><HoursManager /></ProtectedRoute>} />
      <Route path="/dashboard/appointments" element={<ProtectedRoute roles={['emprendedor']}><EntrepreneurAppointments /></ProtectedRoute>} />
      <Route path="/dashboard/stats" element={<ProtectedRoute roles={['emprendedor']}><Stats /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/stores" element={<ProtectedRoute roles={['admin']}><AdminStores /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <AgentChat />
    </>
  );
}
