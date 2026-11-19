import { useEffect, useRef, useState, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { INTERVALO_MS } from '../config';

// Consulta cada `cada` ms mientras la pantalla está visible. `recargar()` sirve para el botón "Reintentar".
export default function useSondeo(funcion, cada = INTERVALO_MS, activo = true) {
  const enfocada = useIsFocused();
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
    if (!activo || !enfocada) return undefined;
    recargar();
    const id = setInterval(recargar, cada);
    return () => clearInterval(id);
  }, [cada, activo, enfocada, recargar]);

  return { datos, error, cargando, recargar };
}
