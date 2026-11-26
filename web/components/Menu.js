import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { leerSesion, cerrarLocal } from '../lib/sesion';
import { enviar } from '../lib/api';

export default function Menu() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);

  // Se vuelve a leer la sesión en cada cambio de página (login / cerrar sesión).
  useEffect(() => {
    const s = leerSesion();
    setUsuario(s ? s.usuario : null);
  }, [router.asPath]);

  async function cerrarSesion() {
    // CU-1.3: confirmar y, aunque no haya red, borrar la sesión local
    if (!window.confirm('¿Quieres cerrar tu sesión?')) return;
    try {
      await enviar('/auth/logout', 'POST');
    } catch {}
    cerrarLocal();
    setUsuario(null);
    router.push('/login');
  }

  return (
    <nav aria-label="Navegación principal">
      <strong className="marca">🅿 Smart-Parking</strong>
      <Link href="/">Inicio</Link>
      {/* Panel de cada rol: es la pantalla de "Hola, nombre" que se abre al iniciar sesión */}
      {usuario && <Link href={usuario.rol === 'Operador' ? '/operador' : '/conductor'}>Panel</Link>}
      {usuario && <Link href="/disponibilidad">Disponibilidad</Link>}
      {usuario && usuario.rol === 'Conductor' && (
        <>
          <Link href="/conductor/estacionamiento">Estacionamiento</Link>
          <Link href="/conductor/vincular">Registrar boleto</Link>
          <Link href="/conductor/estancia">Mi estancia</Link>
          <Link href="/conductor/historial">Historial</Link>
        </>
      )}
      {usuario && usuario.rol === 'Operador' && (
        <>
          <Link href="/operador/estacionamientos">Gestión de estacionamientos</Link>
          <Link href="/operador/cajones">Cajones</Link>
          <Link href="/operador/tarifas">Tarifas</Link>
          <Link href="/operador/boletos">Boletos</Link>
          <Link href="/operador/cobro">Cobro y salida</Link>
        </>
      )}
      {usuario ? (
        <button onClick={cerrarSesion}>Cerrar sesión ({usuario.nombre.split(' ')[0]})</button>
      ) : (
        <>
          <Link href="/login" className="derecha">Iniciar sesión</Link>
          <Link href="/registro">Registrarse</Link>
        </>
      )}
    </nav>
  );
}
