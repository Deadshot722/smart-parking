import { useState } from 'react';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { dinero } from '../../lib/formato';

// CU-5.3: tarifas y condiciones (costo por hora, tolerancia en minutos)
export default function Tarifas() {
  const usuario = useSesion('Operador');
  const { datos: tarifas, error, recargar } = useSondeo(() => pedirJSON('/tarifas'), 15000, Boolean(usuario));
  const { datos: lista } = useSondeo(() => pedirJSON('/estacionamientos'), 30000, Boolean(usuario));
  const vacio = { id_estacionamiento: '', costo: '', horario: '', minutos_tolerancia: 15 };
  const [form, setForm] = useState(vacio);
  const [edicion, setEdicion] = useState(null);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  async function guardar(e) {
    e.preventDefault();
    const costo = Number(form.costo);
    if (form.costo === '' || !(costo >= 0)) return setMensaje({ tipo: 'error', texto: 'Escribe un costo válido (0 o más).' });
    if (!edicion && !form.id_estacionamiento) return setMensaje({ tipo: 'error', texto: 'Elige el estacionamiento.' });
    const cuerpo = { costo, horario: form.horario, minutos_tolerancia: Number(form.minutos_tolerancia) };
    try {
      if (edicion) await enviar(`/tarifas/${edicion}`, 'PUT', cuerpo);
      else await enviar('/tarifas', 'POST', { ...cuerpo, id_estacionamiento: Number(form.id_estacionamiento) });
      setForm(vacio); setEdicion(null);
      setMensaje({ tipo: 'exito', texto: 'Tarifa guardada.' });
      recargar();
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  async function eliminar(t) {
    if (!window.confirm('¿Eliminar esta tarifa?')) return;
    try { await enviar(`/tarifas/${t.id_tarifa}`, 'DELETE'); recargar(); setMensaje({ tipo: 'exito', texto: 'Tarifa eliminada.' }); }
    catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  if (!usuario) return null;
  return (
    <main>
      <h1>Tarifas y condiciones</h1>
      <p className="pie">Los boletos nuevos usan la tarifa más reciente de su estacionamiento. El costo es por hora o fracción.</p>
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <form onSubmit={guardar} className="fila" noValidate>
          {!edicion && (
            <label>Estacionamiento
              <select value={form.id_estacionamiento} onChange={(e) => setForm({ ...form, id_estacionamiento: e.target.value })}>
                <option value="">Elige…</option>
                {(lista || []).map((e) => <option key={e.id_estacionamiento} value={e.id_estacionamiento}>{e.nombre}</option>)}
              </select>
            </label>
          )}
          <label>Costo por hora ($)<input type="number" min="0" step="0.5" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} /></label>
          <label>Descripción / horario<input value={form.horario || ''} maxLength={50} onChange={(e) => setForm({ ...form, horario: e.target.value })} /></label>
          <label>Tolerancia (min)<input type="number" min="0" max="240" value={form.minutos_tolerancia} onChange={(e) => setForm({ ...form, minutos_tolerancia: e.target.value })} /></label>
          {edicion && <button type="button" className="secundario" onClick={() => { setEdicion(null); setForm(vacio); }}>Cancelar</button>}
          <button type="submit">{edicion ? 'Actualizar' : 'Agregar'}</button>
        </form>
      </section>
      {mensaje.texto && <p className={mensaje.tipo === 'error' ? 'error' : 'exito'}>{mensaje.texto}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>ID</th><th>Estacionamiento</th><th>Costo</th><th>Descripción</th><th>Tolerancia</th><th></th></tr></thead>
          <tbody>
            {(tarifas || []).map((t) => (
              <tr key={t.id_tarifa}>
                <td>{t.id_tarifa}</td><td>{t.estacionamiento}</td><td>{dinero(t.costo)}</td><td>{t.horario}</td><td>{t.minutos_tolerancia} min</td>
                <td>
                  <button className="secundario" onClick={() => { setEdicion(t.id_tarifa); setForm({ ...vacio, costo: t.costo, horario: t.horario || '', minutos_tolerancia: t.minutos_tolerancia }); }}>Editar</button>{' '}
                  <button className="peligro" onClick={() => eliminar(t)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
