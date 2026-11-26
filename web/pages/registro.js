import { useState } from 'react';
import { useRouter } from 'next/router';
import { enviar } from '../lib/api';
import {
  soloLetras, errorNombre, limpiarCorreo, errorCorreo,
  limpiarContrasena, validarContrasena, SIMBOLOS_CONTRASENA,
} from '../lib/validaciones';
import BotonGitHub from '../components/BotonGitHub';

// CU-1.1 Registrar cuenta (el usuario elige si es Conductor u Operador)
export default function Registro() {
  const router = useRouter();
  const [rol, setRol] = useState('Conductor');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function registrar(e) {
    e.preventDefault();
    setError('');
    const datos = { nombre: nombre.trim().replace(/\s+/g, ' '), correo: correo.trim(), contrasena, rol };

    if (!datos.nombre || !datos.correo || !contrasena || !confirmar) return setError('Completa todos los campos.');
    const problemaNombre = errorNombre(datos.nombre);
    if (problemaNombre) return setError(`${problemaNombre}.`);
    const problemaCorreo = errorCorreo(datos.correo);
    if (problemaCorreo) return setError(`${problemaCorreo}.`);
    if (!validarContrasena(contrasena)) {
      return setError(`La contraseña debe tener de 8 a 72 caracteres, al menos una letra y un número. Solo se permiten letras, números y ${SIMBOLOS_CONTRASENA}`);
    }
    if (contrasena !== confirmar) return setError('Las contraseñas no coinciden.');

    setEnviando(true);
    try {
      const r = await enviar('/auth/registro', 'POST', datos);
      setExito(`${r.mensaje}. Redirigiendo al inicio de sesión…`);
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setError(err.message); // por ejemplo: "Ese correo ya está registrado"
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main>
      <h1>Registrar cuenta</h1>
      <form onSubmit={registrar} className="formulario" noValidate>
        <fieldset className="opciones-rol">
          <legend>Tipo de cuenta</legend>
          <label className={rol === 'Conductor' ? 'elegido' : ''}>
            <input type="radio" name="rol" value="Conductor" checked={rol === 'Conductor'} onChange={() => setRol('Conductor')} />
            <span><strong>Conductor</strong><small>Consulta disponibilidad, registra tu boleto y paga</small></span>
          </label>
          <label className={rol === 'Operador' ? 'elegido' : ''}>
            <input type="radio" name="rol" value="Operador" checked={rol === 'Operador'} onChange={() => setRol('Operador')} />
            <span><strong>Operador</strong><small>Administra estacionamientos, cajones y tarifas</small></span>
          </label>
        </fieldset>

        <label>
          Nombre (solo letras)
          <input value={nombre} maxLength={100} autoComplete="name" onChange={(e) => setNombre(soloLetras(e.target.value))} />
        </label>

        <label>
          Correo
          {/* type="text" + inputMode="email": deja escribir el @ con cualquier teclado (AltGr+Q, Shift+2) */}
          <input
            type="text"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={100}
            placeholder="nombre@gmail.com"
            value={correo}
            onChange={(e) => setCorreo(limpiarCorreo(e.target.value))}
          />
          <small className="ayuda">Mínimo 6 caracteres antes del @. Gmail, Hotmail, Outlook, Live, Yahoo, iCloud o tu correo del IPN.</small>
        </label>

        <label>
          Contraseña
          <input type="password" value={contrasena} maxLength={72} autoComplete="new-password" onChange={(e) => setContrasena(limpiarContrasena(e.target.value))} />
          <small className="ayuda">Mínimo 8 caracteres, con al menos una letra y un número. Símbolos permitidos: {SIMBOLOS_CONTRASENA.split('').join(' ')}</small>
        </label>
        <label>
          Confirmar contraseña
          <input type="password" value={confirmar} maxLength={72} autoComplete="new-password" onChange={(e) => setConfirmar(limpiarContrasena(e.target.value))} />
        </label>

        <div className="fila">
          <button type="button" className="secundario" onClick={() => router.push('/login')}>Cancelar</button>
          <button type="submit" disabled={enviando}>{enviando ? 'Registrando…' : 'Crear cuenta'}</button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
      {exito && <p className="exito">{exito}</p>}
      <div className="separador"><span>o</span></div>
      <BotonGitHub modo="registro" rol={rol}>Registrarme con GitHub como {rol}</BotonGitHub>
      <p className="pie">Se usa el correo verificado de tu cuenta de GitHub. El tipo de cuenta es el que elegiste arriba.</p>
    </main>
  );
}
