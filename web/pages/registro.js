import { useState } from 'react';
import { useRouter } from 'next/router';
import { enviar } from '../lib/api';
import { soloLetras, validarNombre, validarCorreo, validarContrasena } from '../lib/validaciones';

export default function Registro() {
  const router = useRouter();
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
    const datos = { nombre: nombre.trim().replace(/\s+/g, ' '), correo: correo.trim(), contrasena };

    if (!datos.nombre || !datos.correo || !contrasena) return setError('Completa todos los campos.');
    if (!validarNombre(datos.nombre)) return setError('El nombre solo puede contener letras y espacios.');
    if (!validarCorreo(datos.correo)) return setError('El correo no tiene un formato válido.');
    if (!validarContrasena(contrasena)) return setError('La contraseña debe tener al menos 8 caracteres.');
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
      <h1>Registro de conductor</h1>
      <form onSubmit={registrar} className="formulario" noValidate>
        <label>
          Nombre (solo letras)
          <input value={nombre} maxLength={100} autoComplete="name" onChange={(e) => setNombre(soloLetras(e.target.value))} />
        </label>
        <label>Correo<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" /></label>
        <label>Contraseña (mínimo 8 caracteres)<input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="new-password" /></label>
        <label>Confirmar contraseña<input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" /></label>
        <div className="fila">
          <button type="button" className="secundario" onClick={() => router.push('/login')}>Cancelar</button>
          <button type="submit" disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar'}</button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
      {exito && <p className="exito">{exito}</p>}
    </main>
  );
}
