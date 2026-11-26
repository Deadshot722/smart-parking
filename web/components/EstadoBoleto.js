// Estados de un boleto, con lo que significa cada uno para el operador:
//   Activo             -> el auto entró y todavía no se paga nada
//   Pagado             -> el conductor ya pagó en la app y está dentro de su tolerancia para salir
//   Tolerancia vencida -> pagó, pero no salió a tiempo: se le cobra el tiempo extra (en la base sigue como "Pagado")
//   Finalizado         -> el auto ya salió por la caseta: la estancia está cerrada
export const ESTADOS_BOLETO = {
  Activo: { etiqueta: 'Activo', detalle: 'Dentro, sin pagar', clase: 'estado-activo' },
  Pagado: { etiqueta: 'Pagado', detalle: 'En tolerancia para salir', clase: 'estado-pagado' },
  Vencido: { etiqueta: 'Tolerancia vencida', detalle: 'Debe el tiempo extra', clase: 'estado-activo' },
  Finalizado: { etiqueta: 'Finalizado', detalle: 'Ya salió por caseta', clase: 'estado-finalizado' },
};

export default function EstadoBoleto({ estado, vencida = false }) {
  const info = ESTADOS_BOLETO[estado === 'Pagado' && vencida ? 'Vencido' : estado] || { etiqueta: estado, detalle: '', clase: '' };
  return (
    <span className={`estado ${info.clase}`} title={info.detalle}>
      {info.etiqueta}
      {info.detalle && <small>{info.detalle}</small>}
    </span>
  );
}

export function LeyendaEstados() {
  return (
    <p className="leyenda-estados">
      <strong>Activo</strong>: el auto está dentro y no ha pagado. · <strong>Pagado</strong>: ya pagó en la app y está dentro de
      su tolerancia para salir. · <strong>Tolerancia vencida</strong>: pagó pero no salió a tiempo; hay que cobrarle el tiempo extra
      o darle un boleto nuevo. · <strong>Finalizado</strong>: el auto ya salió por la caseta.
    </p>
  );
}
