import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { pedirJSON } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import { dinero, formatearFechaHora } from '../../lib/formato';
import EstadoBoleto, { LeyendaEstados } from '../../components/EstadoBoleto';

// Consulta de TODOS los boletos de los estacionamientos del operador (con búsqueda, filtros y páginas)
export default function Boletos() {
  const usuario = useSesion('Operador');
  const [lista, setLista] = useState([]);
  const [folio, setFolio] = useState('');
  const [buscado, setBuscado] = useState('');
  const [estado, setEstado] = useState('');
  const [idEst, setIdEst] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    pedirJSON('/operador/estacionamientos').then(setLista).catch(() => {});
  }, [usuario]);

  // Espera a que el operador deje de escribir el folio antes de buscar
  useEffect(() => {
    const t = setTimeout(() => { setBuscado(folio.trim()); setPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [folio]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ pagina: String(pagina) });
      if (buscado) params.set('folio', buscado);
      if (estado) params.set('estado', estado);
      if (idEst) params.set('estacionamiento', idEst);
      setDatos(await pedirJSON(`/caseta/boletos?${params}`));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [pagina, buscado, estado, idEst]);

  useEffect(() => {
    if (usuario) cargar();
  }, [usuario, cargar]);

  if (!usuario) return null;
  const desde = datos && datos.total > 0 ? (datos.pagina - 1) * datos.por_pagina + 1 : 0;
  const hasta = datos ? Math.min(datos.total, datos.pagina * datos.por_pagina) : 0;

  return (
    <main>
      <h1>Consulta de boletos</h1>
      <p className="pie">Todos los boletos de tus estacionamientos, del más reciente al más antiguo.</p>

      <section className="panel">
        <div className="fila">
          <label>Folio
            <input value={folio} maxLength={20} placeholder="000001" onChange={(e) => setFolio(e.target.value.replace(/[^A-Za-z0-9-]/g, ''))} />
          </label>
          <label>Estado
            <select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
              <option value="">Todos</option>
              <option value="Activo">Activo (dentro, sin pagar)</option>
              <option value="Pagado">Pagado (pagó en la app, aún no sale; incluye tolerancia vencida)</option>
              <option value="Finalizado">Finalizado (ya salió)</option>
            </select>
          </label>
          <label>Estacionamiento
            <select value={idEst} onChange={(e) => { setIdEst(e.target.value); setPagina(1); }}>
              <option value="">Todos</option>
              {lista.map((e) => <option key={e.id_estacionamiento} value={e.id_estacionamiento}>{e.nombre}</option>)}
            </select>
          </label>
          <button type="button" className="secundario" onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</button>
        </div>
      </section>

      <LeyendaEstados />
      {error && <p className="error">{error}</p>}
      {datos && datos.total === 0 && <p>No hay boletos con esos filtros.</p>}
      {datos && datos.total > 0 && (
        <>
          <p className="pie">Mostrando {desde}–{hasta} de {datos.total} boletos</p>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr><th>Folio</th><th>Estacionamiento</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Cajón</th><th>Monto</th><th></th></tr>
              </thead>
              <tbody>
                {datos.boletos.map((b) => (
                  <tr key={b.folio}>
                    <td>{b.folio}</td>
                    <td>{b.estacionamiento}</td>
                    <td>{formatearFechaHora(b.entrada)}</td>
                    <td>{b.salida ? formatearFechaHora(b.salida) : '—'}</td>
                    <td><EstadoBoleto estado={b.estado} vencida={b.tolerancia_vencida} /></td>
                    <td>{b.cajon ? `${b.nivel} · ${b.cajon}` : '—'}</td>
                    <td>{b.estado === 'Finalizado' ? `${dinero(b.monto_total)} cobrado` : b.monto_a_cobrar > 0 ? `${dinero(b.monto_a_cobrar)} por cobrar` : 'Sin cobro pendiente'}</td>
                    <td>{b.estado !== 'Finalizado' && <Link href={`/operador/cobro?folio=${encodeURIComponent(b.folio)}`}>Cobrar</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fila paginas">
            <button type="button" className="secundario" disabled={datos.pagina <= 1} onClick={() => setPagina(datos.pagina - 1)}>← Anterior</button>
            <span className="pie">Página {datos.pagina} de {datos.paginas}</span>
            <button type="button" className="secundario" disabled={datos.pagina >= datos.paginas} onClick={() => setPagina(datos.pagina + 1)}>Siguiente →</button>
          </div>
        </>
      )}
    </main>
  );
}
