// Cross-Origin Isolation (COOP/COEP) service worker
// Based on https://github.com/gzuidhof/coi-serviceworker

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only same-origin requests; leave cross-origin untouched
  if (url.origin !== self.location.origin) return;

  const handle = async () => {
    const response = await fetch(request);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };

  event.respondWith(handle());
});

