import { useState } from 'react';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { validarDireccion, validarHoras, armarHorario, separarHorario } from '../../lib/validaciones';

const FORM_VACIO = { nombre: '', direccion: '', abre: '07:00', cierra: '22:00', todoElDia: false };

// CU-5.2 / RF-1.2: registrar y modificar estacionamientos y sus niveles (con sectores y cajones)
export default function Estacionamientos() {
  const usuario = useSesion('Operador');
  const { datos: lista, error, recargar } = useSondeo(() => pedirJSON('/operador/estacionamientos'), 10000, Boolean(usuario));
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [edicion, setEdicion] = useState(null);
  const [nivel, setNivel] = useState({ idEst: '', nombre: '', sectores: 2, cajones_por_sector: 10 });
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const aviso = (tipo, texto) => setMensaje({ tipo, texto });

  async function guardar(e) {
    e.preventDefault();
    const nombre = form.nombre.trim();
    const direccion = form.direccion.trim().replace(/\s+/g, ' ');
    if (!nombre || !direccion) return aviso('error', 'Nombre y dirección son obligatorios.');
    if (nombre.length < 3) return aviso('error', 'El nombre debe tener al menos 3 caracteres.');
    const errDir = validarDireccion(direccion);
    if (errDir) return aviso('error', errDir);
    const errHora = validarHoras(form.abre, form.cierra, form.todoElDia);
    if (errHora) return aviso('error', errHora);

    const cuerpo = { nombre, direccion, horario: armarHorario(form.abre, form.cierra, form.todoElDia) };
    setGuardando(true);
    aviso('', 'Guardando…');
    try {
      const r = edicion
        ? await enviar(`/estacionamientos/${edicion}`, 'PUT', cuerpo)
        : await enviar('/estacionamientos', 'POST', cuerpo);
      setForm(FORM_VACIO);
      setEdicion(null);
      aviso('exito', r.ubicacion_encontrada ? `${r.mensaje}. Ubicación: ${r.ubicacion_encontrada}` : r.mensaje);
      recargar();
    } catch (err) { aviso('error', err.message); }
    finally { setGuardando(false); }
  }

  function editar(est) {
    setEdicion(est.id_estacionamiento);
    setForm({ nombre: est.nombre, direccion: est.direccion, ...separarHorario(est.horario) });
    aviso('', '');
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
      <h1>Gestión de estacionamientos</h1>
      {error && <p className="error">{error}</p>}
      {mensaje.texto && <p className={mensaje.tipo === 'error' ? 'error' : mensaje.tipo === 'exito' ? 'exito' : 'pie'}>{mensaje.texto}</p>}

      <section className="panel">
        <h2>{edicion ? 'Modificar estacionamiento' : 'Registrar estacionamiento'}</h2>
        <form onSubmit={guardar} className="formulario" noValidate>
          <label>Nombre<input placeholder="Plaza Central" value={form.nombre} maxLength={100} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
          <label>
            Dirección
            <input
              placeholder="Av. Insurgentes Sur 1234, Del Valle, Benito Juárez, Ciudad de México"
              value={form.direccion}
              maxLength={200}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
            <small className="ayuda">Calle y número, colonia, alcaldía o municipio y ciudad. Solo se revisa el formato: tú eres responsable de que sea la dirección correcta.</small>
          </label>
          <div className="fila">
            <label>Abre<input type="time" value={form.abre} disabled={form.todoElDia} onChange={(e) => setForm({ ...form, abre: e.target.value })} /></label>
            <label>Cierra<input type="time" value={form.cierra} disabled={form.todoElDia} onChange={(e) => setForm({ ...form, cierra: e.target.value })} /></label>
          </div>
          <label className="casilla">
            <input type="checkbox" checked={form.todoElDia} onChange={(e) => setForm({ ...form, todoElDia: e.target.checked })} />
            Abierto 24 horas
          </label>
          <div className="fila">
            {edicion && <button type="button" className="secundario" onClick={() => { setEdicion(null); setForm(FORM_VACIO); aviso('', ''); }}>Cancelar</button>}
            <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
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

      <h2>Mis estacionamientos</h2>
      {lista && lista.length === 0 && <p>Aún no has creado estacionamientos. Usa el formulario de arriba.</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>ID</th><th>Nombre</th><th>Dirección</th><th>Horario</th><th>Libres / Total</th><th></th></tr></thead>
          <tbody>
            {(lista || []).map((e) => (
              <tr key={e.id_estacionamiento}>
                <td>{e.id_estacionamiento}</td><td>{e.nombre}</td><td>{e.direccion}</td><td>{e.horario}</td>
                <td>{e.libres} / {e.total}</td>
                <td>
                  <button className="secundario" onClick={() => editar(e)}>Editar</button>{' '}
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
