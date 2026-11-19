// '2026-10-29T20:05:09.000Z' -> '29/10/2026 14:05' (hora local del celular)
export function formatearFechaHora(texto) {
  if (!texto) return '';
  const f = new Date(texto);
  if (Number.isNaN(f.getTime())) return String(texto);
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${dos(f.getHours())}:${dos(f.getMinutes())}`;
}
export const dinero = (n) => `$${Number(n || 0).toFixed(2)}`;
export function duracion(minutos) {
  const m = Math.max(0, Number(minutos) || 0);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} h`;
}
