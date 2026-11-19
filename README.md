# Smart-Parking

Sistema de gestión de aforo y cobro de estacionamientos (Laboratorio de Desarrollo de Software III, 5IV6).
Mismo stack y organización que el proyecto de Programación Web (Muñoz): **Express** (modelo / controlador / rutas), **bcryptjs**, **dotenv**, **Next.js** con proxy `/api`, `.env.example`, seed y colección de Postman. La base de datos es **PostgreSQL (Supabase)**.

| Carpeta | Qué es | Dónde se publica |
|---|---|---|
| `database/` | Script SQL de PostgreSQL | Supabase (SQL Editor) |
| `backend/` | API Express + `pg` | Render |
| `web/` | Web Next.js: panel público, conductor y **operador** (kiosco, cobro, administración) | Vercel |
| `mobile/` | App del conductor (React Native + Expo, pantallas M1–M10), lista para Android Studio | Emulador / APK |
| `postman/` | Colección con 33 peticiones y pruebas de código de estado | – |
| `docs/` | Requerimientos, casos de uso, wireframes y diagramas originales | – |

👉 **Publicar en Supabase + Render + Vercel y abrir la app en Android Studio: [DESPLIEGUE.md](DESPLIEGUE.md)**

> El documento original planeaba una app de escritorio en Java para el operador. Aquí esa parte (kiosco, cobro y salida, administración) está dentro de la **web** (`/operador/...`).

## Ejecutar todo en tu PC (desarrollo)
Necesitas Node 18+ y PostgreSQL (local) **o** una base en Supabase.

**1. Base de datos.** Crea la base `smart_parking` y ejecuta el script:
```
psql -U postgres -c "CREATE DATABASE smart_parking"
psql -U postgres -d smart_parking -f database/smart_parking_postgres.sql
```
(o pega el script en el SQL Editor de Supabase).

**2. Backend** (terminal 1)
```
cd backend
copy .env.example .env      (Mac/Linux: cp .env.example .env)   -> pon tu DATABASE_URL
npm install
npm run seed
npm start
```
Debe decir `Smart-Parking API escuchando en el puerto 3001`.

**3. Web** (terminal 2)
```
cd web
npm install
npm start
```
Abre http://localhost:3000 (si el backend usa otro puerto, crea `web/.env.local` con `BACKEND_URL=http://localhost:PUERTO`).

**4. App móvil** (terminal 3) → ver el paso 5 de [DESPLIEGUE.md](DESPLIEGUE.md).

Usuarios de ejemplo (contraseña **Segura2026**): `operador@smartparking.mx` y `conductor@smartparking.mx`.

## Rutas de la web
| Ruta | Quién | Qué hace |
|---|---|---|
| `/` | Todos | Aforo en tiempo real (cada 2 s), tarifas, horarios y políticas |
| `/disponibilidad` | Todos | Niveles, sectores y mapa de cajones |
| `/login`, `/registro` | Todos | Inicio de sesión y registro (nombre solo letras) |
| `/conductor/...` | Conductor | Vincular boleto, estancia, ubicar vehículo, pagar, comprobante, historial |
| `/operador` | Operador | Panel con aforo y últimos boletos |
| `/operador/kiosco` | Operador | Simulador de pluma: "Obtener boleto" |
| `/operador/cobro` | Operador | Folio → monto, tolerancia, confirmar pago y salida |
| `/operador/estacionamientos`, `/cajones`, `/tarifas` | Operador | Administración (CU-5.2, CU-5.3) |

## Reglas de negocio implementadas
- **Aforo** = cajones `Disponible` / `Ocupado`. Al sacar boleto en el kiosco se reserva el primer cajón libre; el conductor puede cambiar su cajón real (el anterior se libera) y al registrar la salida el cajón queda libre (RF-1.4, RF-1.8, CU-2.2).
- **Concurrencia (RNF-3)**: transacciones con `SELECT … FOR UPDATE`; si dos personas eligen el mismo cajón gana una y la otra ve "El cajón acaba de ser ocupado, seleccione otro".
- **Cobro**: `tarifa.costo` es por hora o fracción, mínimo 1 hora. Pagado desde la app → `tolerancia` minutos para salir; si se excede, en caseta se cobra el tiempo extra (RF-1.7).
- **Seguridad**: contraseñas con bcrypt (RNF-5), token de sesión en la tabla `sesion`, roles Conductor / Operador, RLS activado en Supabase, y los datos de la tarjeta **no se guardan** (solo los últimos 4 dígitos).
- **Validaciones** iguales en backend, web y móvil. El nombre solo acepta letras (con acentos y ñ) y espacios; los campos bloquean números y símbolos mientras se escribe.
- **Fechas** en `timestamptz`; web y app las muestran en la hora local del dispositivo.
- "Sector" no existe como tabla: se deriva de la letra inicial del número de cajón (A01, B05…).

## Tema visual
Colores del `style.css` del equipo (fondo `#280b0f`, tarjetas `#7B694E`, acento `#3b1319`, texto secundario `#C6B39a`). Web: `web/styles/home.css`. Móvil: `mobile/src/components/ui.js`.
