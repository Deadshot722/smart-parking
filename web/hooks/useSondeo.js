import { useEffect, useRef, useState, useCallback } from 'react';

// Pide los datos cada `cada` ms (RNF-1: el aforo se ve reflejado en máx. 2 segundos).
export default function useSondeo(funcion, cada = 2000, activo = true) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const ref = useRef(funcion);
  ref.current = funcion;

  const recargar = useCallback(async () => {
    try {
      setDatos(await ref.current());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!activo) return undefined;
    recargar();
    const id = setInterval(recargar, cada);
    return () => clearInterval(id);
  }, [cada, activo, recargar]);

  return { datos, error, cargando, recargar };
}
