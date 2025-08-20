/*! coi-serviceworker v0.1.6 - Guido Zuidhof, licensed under MIT */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

  async function handleFetch(request) {
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
      return;
    }

    const r = await fetch(request);
    if (r.status === 0) {
      return r;
    }

    const headers = new Headers(r.headers);
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');

    return new Response(r.body, {
      status: r.status,
      statusText: r.statusText,
      headers
    });
  }

  self.addEventListener('fetch', function (e) {
    e.respondWith(handleFetch(e.request));
  });
} else {
  (() => {
    const reloadTries = 1;
    const reloadTimeout = 5000;

    const reload = () => window.location.reload();
    const forceReload = () => window.location.reload(true);

    const isCoiActivated = () => {
      return (typeof SharedArrayBuffer !== 'undefined');
    };

    const tryRegisterSW = async () => {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported.');
      }

      if (!isCoiActivated()) {
        await navigator.serviceWorker.register(window.document.currentScript.src, {
          scope: '/'
        });

        if (reloadTries === 1) {
          window.addEventListener('load', () => setTimeout(reload, reloadTimeout));
        }

        return false;
      }
      return true;
    };

    if (!tryRegisterSW()) {
      throw new Error('COI activation failed');
    }
  })();
}