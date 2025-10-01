// sw.js – Service Worker actualizado para Cocina Inventario PWA

// Cambia la versión cada vez que actualices archivos críticos
const CACHE_NAME = 'cocina-inventario-v10'; 

// Archivos a cachear
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.webmanifest',
  // agrega aquí cualquier icono u otro archivo que uses
];

// Instalación: cachear archivos
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando archivos versión nueva');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting(); // activa SW inmediatamente
});

// Activación: limpiar caches antiguos
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eliminando cache vieja:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim(); // toma control inmediato
});

// Interceptar requests y responder desde cache si existe
self.addEventListener('fetch', (evt) => {
  evt.respondWith(
    caches.match(evt.request).then((resp) => {
      return resp || fetch(evt.request);
    })
