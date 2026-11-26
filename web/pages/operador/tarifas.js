import Link from 'next/link';
import { useState } from 'react';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { dinero } from '../../lib/formato';

// CU-5.3: tarifas y condiciones.
// La regla de cobro es fija: costo por hora o fracción, mínimo 1 hora. Lo que el operador define es
// cuánto cuesta la hora, la tolerancia de salida y (opcional) un nombre para reconocer la tarifa.
// Los boletos nuevos usan la tarifa más reciente del estacionamiento ("En uso").
const VACIO = { id_estacionamiento: '', costo: '', nombre: '', minutos_tolerancia: 15 };

export default function Tarifas() {
  const usuario = useSesion('Operador');
  const { datos: tarifas, error, recargar } = useSondeo(() => pedirJSON('/operador/tarifas'), 15000, Boolean(usuario));
  const { datos: lista } = useSondeo(() => pedirJSON('/operador/estacionamientos'), 30000, Boolean(usuario));
  const [form, setForm] = useState(VACIO);
  const [edicion, setEdicion] = useState(null); // tarifa que se está editando
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  async function guardar(e) {
    e.preventDefault();
    const costo = Number(form.costo);
    const tolerancia = Number(form.minutos_tolerancia);
    if (!edicion && !form.id_estacionamiento) return setMensaje({ tipo: 'error', texto: 'Elige el estacionamiento.' });
    if (form.costo === '' || !(costo >= 0)) return setMensaje({ tipo: 'error', texto: 'Escribe el costo por hora (0 o más).' });
    if (!Number.isInteger(tolerancia) || tolerancia < 0 || tolerancia > 240) {
      return setMensaje({ tipo: 'error', texto: 'La tolerancia debe ser un número entero de minutos (0 a 240).' });
    }
    const cuerpo = { costo, horario: form.nombre.trim() || null, minutos_tolerancia: tolerancia };
    try {
      if (edicion) await enviar(`/tarifas/${edicion.id_tarifa}`, 'PUT', cuerpo);
      else await enviar('/tarifas', 'POST', { ...cuerpo, id_estacionamiento: Number(form.id_estacionamiento) });
      setMensaje({ tipo: 'exito', texto: edicion ? 'Tarifa actualizada.' : 'Tarifa agregada. Desde ahora es la que usan los boletos nuevos de ese estacionamiento.' });
      setForm(VACIO);
      setEdicion(null);
      recargar();
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  function editar(t) {
    setEdicion(t);
    setForm({ id_estacionamiento: String(t.id_estacionamiento), costo: t.costo, nombre: t.horario || '', minutos_tolerancia: t.minutos_tolerancia });
    setMensaje({ tipo: '', texto: '' });
  }

  function cancelar() {
    setEdicion(null);
    setForm(VACIO);
  }

  async function eliminar(t) {
    if (!window.confirm(`¿Eliminar la tarifa "${t.horario || 'sin nombre'}" de ${t.estacionamiento}?`)) return;
    try { await enviar(`/tarifas/${t.id_tarifa}`, 'DELETE'); recargar(); setMensaje({ tipo: 'exito', texto: 'Tarifa eliminada.' }); }
    catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  if (!usuario) return null;
  return (
    <main>
      <h1>Tarifas y condiciones</h1>
      <p className="pie">
        Regla de cobro (igual para todos): <strong>por hora o fracción, mínimo 1 hora</strong>. Por ejemplo, con $20 por hora,
        1 h 10 min se cobran como 2 horas = $40. Los boletos nuevos usan la tarifa <strong>en uso</strong> (la más reciente) de su estacionamiento.
      </p>
      {error && <p className="error">{error}</p>}
      {lista && lista.length === 0 && <p>Aún no has creado estacionamientos. Crea el primero en <Link href="/operador/estacionamientos">Gestión de estacionamientos</Link>.</p>}

      <section className="panel">
        <h2>{edicion ? `Editar tarifa de ${edicion.estacionamiento}` : 'Nueva tarifa'}</h2>
        <form onSubmit={guardar} className="formulario" noValidate>
          {!edicion && (
            <label>Estacionamiento
              <select value={form.id_estacionamiento} onChange={(e) => setForm({ ...form, id_estacionamiento: e.target.value })}>
                <option value="">Elige…</option>
                {(lista || []).map((e) => <option key={e.id_estacionamiento} value={e.id_estacionamiento}>{e.nombre}</option>)}
              </select>
            </label>
          )}
          <label>
            Costo por hora ($)
            <input type="number" min="0" step="0.5" placeholder="20" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
            <small className="ayuda">Lo que se cobra por cada hora o fracción de hora.</small>
          </label>
          <label>
            Tolerancia de salida (minutos)
            <input type="number" min="0" max="240" value={form.minutos_tolerancia} onChange={(e) => setForm({ ...form, minutos_tolerancia: e.target.value })} />
            <small className="ayuda">Tiempo que tiene el conductor para salir después de pagar en la app. Si se pasa, en caseta se cobra el tiempo extra.</small>
          </label>
          <label>
            Nombre de la tarifa (opcional)
            <input maxLength={50} placeholder="Tarifa general, Nocturna, Fin de semana…" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <small className="ayuda">Solo sirve para reconocerla en la lista.</small>
          </label>
          <div className="fila">
            {edicion && <button type="button" className="secundario" onClick={cancelar}>Cancelar</button>}
            <button type="submit">{edicion ? 'Guardar cambios' : 'Agregar tarifa'}</button>
          </div>
        </form>
      </section>
      {mensaje.texto && <p className={mensaje.tipo === 'error' ? 'error' : 'exito'}>{mensaje.texto}</p>}

      <h2>Mis tarifas</h2>
      {tarifas && tarifas.length === 0 && <p>Aún no tienes tarifas.</p>}
      {tarifas && tarifas.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Estacionamiento</th><th>Tarifa</th><th>Costo por hora</th><th>Tolerancia de salida</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {tarifas.map((t) => (
                <tr key={t.id_tarifa}>
                  <td>{t.estacionamiento}</td>
                  <td>{t.horario || <span className="pie">Sin nombre</span>}</td>
                  <td>{dinero(t.costo)}</td>
                  <td>{t.minutos_tolerancia} min</td>
                  <td>{t.vigente ? <span className="estado estado-pagado">En uso</span> : <span className="pie">Anterior</span>}</td>
                  <td>
                    <button className="secundario" onClick={() => editar(t)}>Editar</button>{' '}
                    <button className="peligro" onClick={() => eliminar(t)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
