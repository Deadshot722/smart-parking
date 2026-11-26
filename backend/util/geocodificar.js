// OPCIONAL (apagado por defecto): busca la dirección en el mapa gratuito de OpenStreetMap (Nominatim).
// Un mapa no puede asegurar que una dirección exista (faltan calles, números y colonias nuevas), así que
// por defecto solo se revisa el formato y el operador es responsable de escribir la dirección correcta.
// Reglas de uso de Nominatim: máximo 1 consulta por segundo e identificarse con User-Agent.
// Variables de entorno opcionales:
//   VALIDAR_DIRECCION=true    -> activa la búsqueda en el mapa (rechaza direcciones que no encuentre)
//   PAIS_DIRECCION=mx         -> país donde se busca (código ISO, por defecto México)

const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
let ultimaConsulta = 0;

async function esperarTurno() {
    const espera = ultimaConsulta + 1100 - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaConsulta = Date.now();
}

async function buscar(texto) {
    await esperarTurno();
    const params = new URLSearchParams({
        q: texto,
        format: 'jsonv2',
        limit: '1',
        addressdetails: '0',
        countrycodes: process.env.PAIS_DIRECCION || 'mx',
        'accept-language': 'es',
    });
    const res = await fetch(`${URL_NOMINATIM}?${params}`, {
        headers: { 'User-Agent': 'Smart-Parking/2.0 (proyecto escolar CECyT 9)' },
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Nominatim respondió ${res.status}`);
    const datos = await res.json();
    return datos[0] || null;
}

// Abreviaturas comunes en México -> palabra completa (OpenStreetMap busca palabras completas)
const ABREVIATURAS = [
    [/\bav\.?\s/gi, 'Avenida '],
    [/\bavda\.?\s/gi, 'Avenida '],
    [/\bcalz\.?\s/gi, 'Calzada '],
    [/\bblvd\.?\s/gi, 'Boulevard '],
    [/\bprol\.?\s/gi, 'Prolongación '],
    [/\bcarr\.?\s/gi, 'Carretera '],
    [/\bpriv\.?\s/gi, 'Privada '],
    [/\bcol\.?\s/gi, ''],
    [/\bc\.?\s?p\.?\s?/gi, ''],
    [/\bedo\.?\s?(de\s)?m[eé]x\.?/gi, 'Estado de México'],
    [/\bcdmx\b/gi, 'Ciudad de México'],
];

const limpiarTexto = (t) => t.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();
const sinNumeros = (t) => limpiarTexto(t.replace(/(#|no\.?|núm\.?|num\.?)?\s*\d+[a-z]?\b/gi, ' '));

// Versiones de la dirección, de la más exacta a la más general.
// nivel 'calle' = se encontró la calle; nivel 'zona' = solo la colonia o el municipio (la calle no está en el mapa).
function candidatos(direccion) {
    let normal = direccion;
    for (const [patron, cambio] of ABREVIATURAS) normal = normal.replace(patron, cambio);
    normal = limpiarTexto(normal);
    const partes = sinNumeros(normal).split(',').map(limpiarTexto).filter(Boolean);
    const calle = partes[0] || '';
    const resto = partes.slice(1);
    const lista = [
        { texto: direccion, nivel: 'calle' },
        { texto: normal, nivel: 'calle' },
        { texto: partes.join(', '), nivel: 'calle' },
    ];
    if (resto.length >= 2) lista.push({ texto: [calle, ...resto.slice(-2)].join(', '), nivel: 'calle' });
    if (resto.length >= 1) lista.push({ texto: [calle, resto.at(-1)].join(', '), nivel: 'calle' });
    if (resto.length >= 2) lista.push({ texto: [calle, resto.at(-2)].join(', '), nivel: 'calle' });
    if (resto.length >= 2) lista.push({ texto: resto.join(', '), nivel: 'zona' });
    if (resto.length >= 2) lista.push({ texto: resto.slice(-2).join(', '), nivel: 'zona' });
    // Sin repetir búsquedas iguales
    const vistos = new Set();
    return lista.filter((c) => {
        const clave = c.texto.toLowerCase();
        if (!c.texto || vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
    });
}

// Devuelve:
//   { encontrada: true, nivel: 'calle', lugar: 'Avenida Bordo de Xochiaca, …' }
//   { encontrada: true, nivel: 'zona', lugar: 'El Sol, Nezahualcóyotl, …' }  -> la colonia o municipio existe
//   { encontrada: false }                 -> ni la calle ni la zona existen (se rechaza)
//   { encontrada: null }                  -> el servicio no respondió (no se bloquea al operador)
async function verificarDireccion(direccion) {
    if (process.env.VALIDAR_DIRECCION !== 'true') return { encontrada: null };
    const limite = Date.now() + 15000; // máximo 15 s buscando
    try {
        for (const c of candidatos(direccion)) {
            if (Date.now() > limite) return { encontrada: null };
            const r = await buscar(c.texto);
            if (r) return { encontrada: true, nivel: c.nivel, lugar: r.display_name };
        }
        return { encontrada: false };
    } catch (error) {
        console.error('No se pudo verificar la dirección:', error.message);
        return { encontrada: null };
    }
}

module.exports = { verificarDireccion, candidatos };
