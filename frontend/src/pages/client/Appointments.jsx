import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import AppointmentCard from '../../components/AppointmentCard';
import api from '../../lib/api';
import { getUser } from '../../lib/auth';

const FINISHED = ['cancelled', 'completed'];

function loadDismissed(userId) {
  try {
    const raw = localStorage.getItem(`nexo_dismissed_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveDismissed(userId, set) {
  localStorage.setItem(`nexo_dismissed_${userId}`, JSON.stringify([...set]));
}

export default function ClientAppointments() {
  const userId = getUser()?.id;
  const navigate = useNavigate();
  const [hideFinished, setHideFinished] = useState(false);
  const [dismissed, setDismissed] = useState(() => loadDismissed(userId));

  const { data } = useQuery({
    queryKey: ['appointments', userId],
    queryFn: () => api.get('/appointments').then(r => r.data.data),
  });

  const handleDismiss = useCallback((id) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(userId, next);
      return next;
    });
  }, [userId]);

  const all = (data || []).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const displayed = all.filter(a =>
    !dismissed.has(a.id) &&
    (!hideFinished || !FINISHED.includes(a.status))
  );

  const finishedCount = all.filter(a => !dismissed.has(a.id) && FINISHED.includes(a.status)).length;
  const dismissedCount = dismissed.size;

  return (
    <div className="min-h-screen bg-nexo-gray-light">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Mis citas</h1>
          <div className="flex gap-2 flex-wrap">
            {finishedCount > 0 && (
              <button
                onClick={() => setHideFinished(h => !h)}
                className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                style={hideFinished
                  ? { borderColor: '#E8223A', color: '#E8223A', backgroundColor: '#FDEAED' }
                  : { borderColor: '#EBEBEB', color: '#3D3D3D', backgroundColor: '#fff' }
                }
              >
                {hideFinished ? `Activas (${finishedCount} ocultas)` : `Ocultar finalizadas (${finishedCount})`}
              </button>
            )}
            {dismissedCount > 0 && (
              <button
                onClick={() => {
                  const empty = new Set();
                  saveDismissed(userId, empty);
                  setDismissed(empty);
                }}
                className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
                style={{ borderColor: '#EBEBEB', color: '#8A8A8A', backgroundColor: '#fff' }}
              >
                Restaurar eliminadas ({dismissedCount})
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {displayed.map(a => (
            <Link key={a.id} to={`/app/appointments/${a.id}`}>
              <AppointmentCard
                appointment={a}
                onDismiss={
                  FINISHED.includes(a.status)
                    ? handleDismiss
                    : (id) => navigate(`/app/appointments/${id}`)
                }
              />
            </Link>
          ))}
          {displayed.length === 0 && all.length === 0 && (
            <p className="text-nexo-gray-mid text-center py-16">No tienes citas aún.</p>
          )}
          {displayed.length === 0 && all.length > 0 && (
            <p className="text-nexo-gray-mid text-center py-16">
              No hay citas visibles.{' '}
              <button
                onClick={() => { setHideFinished(false); setDismissed(new Set()); saveDismissed(userId, new Set()); }}
                className="text-nexo-red underline"
              >
                Restablecer vista
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
