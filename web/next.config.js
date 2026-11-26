/** @type {import('next').NextConfig} */

// Dirección del backend de Express (carpeta ../backend, puerto 3001 por defecto).
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

module.exports = {
  reactStrictMode: true,
  // Proxy: el navegador solo habla con Next (puerto 3000) y Next reenvía /api/... al Express. Así no hay CORS.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  // La app Android (web/public/descargas/smart-parking.apk) se descarga con el tipo de archivo correcto
  async headers() {
    return [
      {
        source: '/descargas/:archivo*.apk',
        headers: [{ key: 'Content-Type', value: 'application/vnd.android.package-archive' }],
      },
    ];
  },
};
