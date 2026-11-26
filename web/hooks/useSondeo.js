import { useEffect, useRef, useState, useCallback } from 'react';

// Pide los datos cada `cada` ms (RNF-1: el aforo se ve reflejado en máx. 2 segundos).
// `clave`: lo que identifica QUÉ se está consultando (ej. el id del nivel). Cuando cambia, se borran los datos
// anteriores y se consulta de inmediato; así no se ven por unos segundos los cajones del nivel anterior.
// La siguiente consulta empieza cuando termina la anterior (si el servidor tarda, no se amontonan peticiones).
export default function useSondeo(funcion, cada = 2000, activo = true, clave = '') {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const ref = useRef(funcion);
  ref.current = funcion;
  const turno = useRef(0); // cambia con cada clave: las respuestas de una consulta vieja se ignoran

  const recargar = useCallback(async () => {
    const mio = turno.current;
    try {
      const nuevos = await ref.current();
      if (mio === turno.current) {
        setDatos(nuevos);
        setError('');
      }
    } catch (err) {
      if (mio === turno.current) setError(err.message);
    } finally {
      if (mio === turno.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    turno.current += 1;
    setDatos(null);
    setError('');
    setCargando(true);
    if (!activo) return undefined;

    let vivo = true;
    let reloj;
    const ciclo = async () => {
      await recargar();
      if (vivo) reloj = setTimeout(ciclo, cada);
    };
    ciclo();
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [cada, activo, clave, recargar]);

  return { datos, error, cargando, recargar };
}
