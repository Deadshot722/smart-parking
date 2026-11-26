// Barra de ocupación: verde = libres, rojo = ocupados.
export default function BarraAforo({ libres, ocupados }) {
  const total = libres + ocupados;
  const pct = total === 0 ? 0 : Math.round((ocupados / total) * 100);
  return (
    <div className="barra" role="img" aria-label={`${pct}% ocupado`}>
      <div className="barra-ocupado" style={{ width: `${pct}%` }} />
    </div>
  );
}
