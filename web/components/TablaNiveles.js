import BarraAforo from './BarraAforo';

// Tarjetas por nivel y sector: "Sótano 1: 20 libres -> Sector A: 15 libres" (RF-2.2, CU-2.1)
export default function TablaNiveles({ niveles, onElegir, elegido }) {
  return (
    <div className="rejilla">
      {niveles.map((n) => (
        <article
          key={n.id_nivel}
          className={`tarjeta ${elegido === n.id_nivel ? 'elegida' : ''}`}
          onClick={onElegir ? () => onElegir(n.id_nivel) : undefined}
          style={onElegir ? { cursor: 'pointer' } : undefined}
        >
          <h3>{n.nombre}</h3>
          <p>
            <span className="libre">Libres: {n.libres}</span> · <span className="ocupado">Ocupados: {n.ocupados}</span>
          </p>
          <BarraAforo libres={n.libres} ocupados={n.ocupados} />
          {n.sin_disponibilidad && <p className="etiqueta-lleno">Nivel sin disponibilidad</p>}
          <ul className="sectores">
            {n.sectores.map((s) => (
              <li key={s.sector}>
                Sector {s.sector}: {s.libres} libres
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
