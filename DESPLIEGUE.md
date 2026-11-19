# Cómo publicar Smart-Parking

```
Supabase (PostgreSQL)  <──  Render (backend Express)  <──  Vercel (web Next.js)
                                      ▲
                                      └── App móvil (Android Studio / celular)
```

Orden obligatorio: **1) GitHub → 2) Supabase → 3) Render → 4) Vercel → 5) App móvil**.
Cada paso necesita la dirección que te da el anterior.

---

## 1. Subir el proyecto a GitHub
Se sube la carpeta `smart-parking` completa como un solo repositorio (no se suben `node_modules` ni `.env`; ya están en `.gitignore`).

```
cd smart-parking
git init
git add .
git commit -m "Smart-Parking"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/smart-parking.git
git push -u origin main
```
(Primero crea el repositorio vacío en github.com → New repository.)

---

## 2. Base de datos en Supabase (PostgreSQL)
1. Entra a https://supabase.com → **New project**. Ponle nombre (`smart-parking`), elige una **contraseña de base de datos y guárdala**, y una región cercana (por ejemplo *East US*). Espera 1-2 minutos.
2. Menú izquierdo → **SQL Editor** → **New query**. Abre en tu PC `database/smart_parking_postgres.sql`, copia **todo**, pégalo y pulsa **Run**. Debe decir *Success*. (En **Table Editor** ya verás las 11 tablas.)
3. Arriba pulsa **Connect** → pestaña **Connection string** → en *Method* elige **Session pooler** → copia la URI. Se ve así:
   ```
   postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
   Cambia `[YOUR-PASSWORD]` por tu contraseña (sin los corchetes). Si tiene símbolos, codifícalos: `@`→`%40`, `#`→`%23`, `/`→`%2F`, `:`→`%3A`, `?`→`%3F`.
   > Usa **Session pooler** y no la conexión "Direct": la directa usa IPv6 y Render (plan gratis) no la alcanza.
4. Carga los datos de ejemplo (usuarios y un estacionamiento) **desde tu PC**:
   ```
   cd backend
   npm install
   ```
   Crea el archivo `backend/.env` con una sola línea:
   ```
   DATABASE_URL=postgresql://postgres.abcdefghijkl:TuPassword@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
   y ejecuta `npm run seed`. Debe imprimir *Listo. Operador: …*. Si quieres, ya puedes probar el backend local con `npm start` apuntando a Supabase.

---

## 3. Backend en Render
1. Entra a https://render.com → **New +** → **Web Service** → conecta tu cuenta de GitHub y elige el repositorio `smart-parking`.
2. Llena el formulario:

   | Campo | Valor |
   |---|---|
   | Name | `smart-parking-api` |
   | Region | la más cercana a tu región de Supabase |
   | Branch | `main` |
   | **Root Directory** | `backend` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | `Free` |

3. En **Environment Variables** agrega:
   - `DATABASE_URL` = la URI del Session pooler del paso 2.3 (con tu contraseña).
   - `NODE_VERSION` = `20`
   - **No** pongas `PORT`: Render lo asigna solo y el servidor ya lo lee.
4. **Create Web Service**. Cuando el log diga *Smart-Parking API escuchando en el puerto…* y el estado sea **Live**, copia tu URL (ej. `https://smart-parking-api.onrender.com`).
5. Pruébala en el navegador:
   - `https://smart-parking-api.onrender.com/` → `{"mensaje":"API de Smart-Parking funcionando correctamente"}`
   - `https://smart-parking-api.onrender.com/salud` → `{"api":"ok","base_de_datos":"ok"}` (si dice *sin conexión*, revisa `DATABASE_URL`).
   - `https://smart-parking-api.onrender.com/api/aforo` → el aforo con los cajones.

> El plan gratis de Render se "duerme" tras 15 minutos sin uso: la primera petición después tarda ~50 segundos. Es normal. Antes de una demostración abre la URL un minuto antes.

---

## 4. Web en Vercel
1. Entra a https://vercel.com → **Add New… → Project** → importa el repositorio `smart-parking`.
2. En **Root Directory** pulsa *Edit* y elige **`web`**. *Framework Preset* debe quedar en **Next.js**.
3. En **Environment Variables** agrega:
   - `BACKEND_URL` = `https://smart-parking-api.onrender.com` (tu URL de Render, **sin** `/` al final y **sin** `/api`).
4. **Deploy**. Al terminar abre la URL (ej. `https://smart-parking.vercel.app`) e inicia sesión con `operador@smartparking.mx` / `Segura2026`.

La web llama a `/api/...` en su propio dominio y Next lo reenvía a Render, por eso no hay problemas de CORS. Si cambias `BACKEND_URL`, hay que hacer **Redeploy** (Deployments → ⋯ → Redeploy), porque se lee al construir.

---

## 5. App móvil con Android Studio
Requisitos: Node 18+, Android Studio con un emulador creado (Device Manager → Create device).

1. `cd mobile` → `npm install` → `npx expo install --fix`
2. Copia `.env.example` como `.env` y pon la URL de Render:
   ```
   EXPO_PUBLIC_API_URL=https://smart-parking-api.onrender.com
   ```
   (Para probar con el backend en tu PC: `http://10.0.2.2:3001` en el emulador, o `http://IP-DE-TU-PC:3001` en un celular real.)

**Opción A (rápida, Expo Go):** abre el emulador en Android Studio, luego `npx expo start` y pulsa la tecla **a**. Expo instala Expo Go en el emulador y abre la app.

**Opción B (proyecto nativo para abrir en Android Studio):**
```
npx expo prebuild --platform android
```
Esto crea la carpeta `mobile/android`. En Android Studio: **File → Open → `mobile/android`**, espera a que termine Gradle y pulsa **Run ▶** con el emulador encendido. Desde la terminal es equivalente a `npx expo run:android`.
Para generar un instalable: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

---

## Problemas frecuentes
| Síntoma | Causa / solución |
|---|---|
| Render: `ENETUNREACH` o `connect ETIMEDOUT` a Supabase | Usaste la conexión *Direct*. Cambia a **Session pooler**. |
| Render: `password authentication failed` | Contraseña mal escrita o con símbolos sin codificar en `DATABASE_URL`. |
| Render: `relation "usuario" does not exist` | No se ejecutó `smart_parking_postgres.sql` en el SQL Editor de Supabase. |
| Web: "El servidor no responde" | `BACKEND_URL` mal escrita, o Render dormido (espera ~50 s y recarga). |
| Login falla con "Correo o contraseña incorrectos" | Falta `npm run seed` contra Supabase. |
| App móvil: "No hay conexión con el servidor" | `EXPO_PUBLIC_API_URL` incorrecta; reinicia con `npx expo start -c`. En emulador no uses `localhost`: usa `10.0.2.2`. |
| Supabase pausa el proyecto | En el plan gratis se pausa tras 1 semana sin actividad; se reactiva con un clic en el panel. |
