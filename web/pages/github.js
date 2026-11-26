import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { guardarSesion } from '../lib/sesion';

// Regreso de GitHub: el backend manda aquí #token=... (o #error=...). Se guarda la sesión y se entra.
export default function RegresoGitHub() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const datos = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, '', '/github'); // quita el token de la barra de direcciones
    const token = datos.get('token');
    if (!token) {
      setError(datos.get('error') || 'No se pudo iniciar sesión con GitHub.');
      return;
    }
    fetch('/api/auth/yo', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const usuario = await r.json();
        if (!r.ok) throw new Error(usuario.error || 'No se pudo iniciar sesión con GitHub.');
        guardarSesion({ token, usuario });
        router.replace(usuario.rol === 'Operador' ? '/operador' : '/conductor');
      })
      .catch((e) => setError(e.message));
  }, [router]);

  return (
    <main>
      <h1>GitHub</h1>
      {!error && <p>Iniciando sesión…</p>}
      {error && (
        <>
          <p className="error">{error}</p>
          <p><Link href="/login">Volver a iniciar sesión</Link> · <Link href="/registro">Registrarme</Link></p>
        </>
      )}
    </main>
  );
}
