import { useState } from 'react';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';

// CU-5.2 / RF-1.2: registrar y modificar estacionamientos y sus niveles (con sectores y cajones)
export default function Estacionamientos() {
  const usuario = useSesion('Operador');
  const { datos: lista, error, recargar } = useSondeo(() => pedirJSON('/estacionamientos'), 10000, Boolean(usuario));
  const [form, setForm] = useState({ nombre: '', direccion: '', horario: '' });
  const [edicion, setEdicion] = useState(null);
  const [nivel, setNivel] = useState({ idEst: '', nombre: '', sectores: 2, cajones_por_sector: 10 });
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const aviso = (tipo, texto) => setMensaje({ tipo, texto });

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.direccion.trim()) return aviso('error', 'Nombre y dirección son obligatorios.');
    try {
      if (edicion) await enviar(`/estacionamientos/${edicion}`, 'PUT', form);
      else await enviar('/estacionamientos', 'POST', form);
      setForm({ nombre: '', direccion: '', horario: '' });
      setEdicion(null);
      aviso('exito', 'Estacionamiento guardado.');
      recargar();
    } catch (err) { aviso('error', err.message); }
  }

  async function eliminar(e) {
    if (!window.confirm(`¿Eliminar "${e.nombre}" con todos sus niveles y cajones?`)) return;
    try { await enviar(`/estacionamientos/${e.id_estacionamiento}`, 'DELETE'); aviso('exito', 'Estacionamiento eliminado.'); recargar(); }
    catch (err) { aviso('error', err.message); }
  }

  async function agregarNivel(e) {
    e.preventDefault();
    if (!nivel.idEst || !nivel.nombre.trim()) return aviso('error', 'Elige el estacionamiento y escribe el nombre del nivel.');
    try {
      await enviar(`/estacionamientos/${nivel.idEst}/niveles`, 'POST', {
        nombre: nivel.nombre.trim(), sectores: Number(nivel.sectores), cajones_por_sector: Number(nivel.cajones_por_sector),
      });
      setNivel({ ...nivel, nombre: '' });
      aviso('exito', 'Nivel creado con sus cajones.');
      recargar();
    } catch (err) { aviso('error', err.message); }
  }

  if (!usuario) return null;
  return (
    <main>
      <h1>Estacionamientos y niveles</h1>
      {error && <p className="error">{error}</p>}
      {mensaje.texto && <p className={mensaje.tipo === 'error' ? 'error' : 'exito'}>{mensaje.texto}</p>}

      <section className="panel">
        <h2>{edicion ? 'Modificar estacionamiento' : 'Registrar estacionamiento'}</h2>
        <form onSubmit={guardar} className="formulario" noValidate>
          <input placeholder="Nombre" value={form.nombre} maxLength={100} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input placeholder="Dirección" value={form.direccion} maxLength={200} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          <input placeholder="Horario (ej. 07:00 - 23:00)" value={form.horario || ''} maxLength={50} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
          <div className="fila">
            {edicion && <button type="button" className="secundario" onClick={() => { setEdicion(null); setForm({ nombre: '', direccion: '', horario: '' }); }}>Cancelar</button>}
            <button type="submit">Guardar</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Agregar nivel</h2>
        <form onSubmit={agregarNivel} className="fila" noValidate>
          <label>Estacionamiento
            <select value={nivel.idEst} onChange={(e) => setNivel({ ...nivel, idEst: e.target.value })}>
              <option value="">Elige…</option>
              {(lista || []).map((e) => <option key={e.id_estacionamiento} value={e.id_estacionamiento}>{e.nombre}</option>)}
            </select>
          </label>
          <label>Nombre del nivel<input value={nivel.nombre} maxLength={50} onChange={(e) => setNivel({ ...nivel, nombre: e.target.value })} placeholder="Sótano 2" /></label>
          <label>Sectores (1-10)<input type="number" min="1" max="10" value={nivel.sectores} onChange={(e) => setNivel({ ...nivel, sectores: e.target.value })} /></label>
          <label>Cajones por sector<input type="number" min="1" max="99" value={nivel.cajones_por_sector} onChange={(e) => setNivel({ ...nivel, cajones_por_sector: e.target.value })} /></label>
          <button type="submit">Crear nivel</button>
        </form>
      </section>

      <div className="tabla-scroll">
        <table>
          <thead><tr><th>ID</th><th>Nombre</th><th>Dirección</th><th>Horario</th><th>Libres / Total</th><th></th></tr></thead>
          <tbody>
            {(lista || []).map((e) => (
              <tr key={e.id_estacionamiento}>
                <td>{e.id_estacionamiento}</td><td>{e.nombre}</td><td>{e.direccion}</td><td>{e.horario}</td>
                <td>{e.libres} / {e.total}</td>
                <td>
                  <button className="secundario" onClick={() => { setEdicion(e.id_estacionamiento); setForm({ nombre: e.nombre, direccion: e.direccion, horario: e.horario || '' }); }}>Editar</button>{' '}
                  <button className="peligro" onClick={() => eliminar(e)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
