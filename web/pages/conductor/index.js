import Link from 'next/link';
import useSesion from '../../hooks/useSesion';

export default function InicioConductor() {
  const usuario = useSesion('Conductor');
  if (!usuario) return null;
  return (
    <main>
      <h1>Hola, {usuario.nombre}</h1>
      <div className="menu-grande">
        <Link href="/disponibilidad">Verificar disponibilidad</Link>
        <Link href="/conductor/vincular">Registrar boleto</Link>
        <Link href="/conductor/estancia">Mi estancia actual</Link>
        <Link href="/conductor/ubicacion">Ubicar mi vehículo</Link>
        <Link href="/conductor/historial">Ver historial</Link>
      </div>
    </main>
  );
}
