import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { leerSesion } from '../lib/sesion';

// Protege una página: si no hay sesión (o el rol no coincide) manda al login. Devuelve el usuario.
export default function useSesion(rol) {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const s = leerSesion();
    if (!s || !s.token || (rol && s.usuario.rol !== rol)) {
      router.replace('/login');
      return;
    }
    setUsuario(s.usuario);
  }, [rol, router]);

  return usuario;
}
