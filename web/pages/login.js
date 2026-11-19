import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { enviar } from '../lib/api';
import { guardarSesion } from '../lib/sesion';

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    if (!correo.trim() || !contrasena) return setError('Ingresa tu correo y contraseña.'); // CU-1.2 flujo alterno 2
    setEnviando(true);
    try {
      const datos = await enviar('/auth/login', 'POST', { correo: correo.trim(), contrasena });
      guardarSesion(datos);
      router.push(datos.usuario.rol === 'Operador' ? '/operador' : '/conductor');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main>
      <h1>Iniciar sesión</h1>
      <form onSubmit={entrar} className="formulario" noValidate>
        <label>Correo<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" /></label>
        <label>Contraseña<input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="current-password" /></label>
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Iniciar sesión'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>¿No tienes una cuenta? <Link href="/registro">Regístrate</Link></p>
    </main>
  );
}
