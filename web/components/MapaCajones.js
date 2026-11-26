// Distribución de cajones de un nivel con su estado en tiempo real.
export default function MapaCajones({ cajones, onElegir, elegido }) {
  const sectores = [...new Set(cajones.map((c) => c.sector))];
  return (
    <div>
      {sectores.map((s) => (
        <div key={s}>
          <h4>Sector {s}</h4>
          <div className="cajones">
            {cajones
              .filter((c) => c.sector === s)
              .map((c) => {
                const libre = c.estado === 'Disponible';
                return (
                  <button
                    key={c.id_cajon}
                    type="button"
                    className={`cajon ${libre ? 'cajon-libre' : 'cajon-ocupado'} ${elegido === c.id_cajon ? 'cajon-elegido' : ''}`}
                    disabled={!onElegir}
                    onClick={() => onElegir && onElegir(c)}
                    title={c.estado}
                  >
                    {c.numero}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
