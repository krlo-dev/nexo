const TZ = 'America/Bogota';

// "viernes 20 de mayo, 09:00"
export const formatAppointmentDate = (isoString) => {
  const d = new Date(isoString);
  const weekday  = d.toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long' });
  const dayMonth = d.toLocaleDateString('es-CO', { timeZone: TZ, day: 'numeric', month: 'long' });
  const time     = d.toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${weekday} ${dayMonth}, ${time}`;
};

// "viernes 20 de mayo de 2026, 09:00"
export const formatAppointmentDateFull = (isoString) => {
  const d = new Date(isoString);
  const weekday      = d.toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long' });
  const dayMonthYear = d.toLocaleDateString('es-CO', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
  const time         = d.toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${weekday} ${dayMonthYear}, ${time}`;
};

// "2026-05-20" en hora Colombia — para comparar fechas
export const toColombiaDateStr = (isoString) =>
  new Date(isoString).toLocaleDateString('en-CA', { timeZone: TZ });

// Fecha de hoy en Colombia — "2026-05-20"
export const todayColombia = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: TZ });
