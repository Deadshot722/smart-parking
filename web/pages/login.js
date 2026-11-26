import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { enviar } from '../lib/api';
import { guardarSesion } from '../lib/sesion';
import { limpiarCorreo, limpiarContrasena, errorLogin } from '../lib/validaciones';
import BotonGitHub from '../components/BotonGitHub';

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    // Validación antes de enviar (CU-1.2 flujo alterno 2). El servidor vuelve a validar y limita los intentos fallidos.
    const problema = errorLogin(correo, contrasena);
    if (problema) return setError(problema);
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
        <label>Correo<input type="text" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={100} value={correo} onChange={(e) => setCorreo(limpiarCorreo(e.target.value))} autoComplete="email" /></label>
        <label>Contraseña<input type="password" maxLength={72} value={contrasena} onChange={(e) => setContrasena(limpiarContrasena(e.target.value))} autoComplete="current-password" /></label>
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Iniciar sesión'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="separador"><span>o</span></div>
      <BotonGitHub modo="login">Iniciar sesión con GitHub</BotonGitHub>
      <p>¿No tienes una cuenta? <Link href="/registro">Regístrate</Link></p>
    </main>
  );
}
