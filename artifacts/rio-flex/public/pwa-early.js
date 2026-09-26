// Captura o evento de instalação do PWA antes do React carregar (arquivo externo: permite CSP sem 'unsafe-inline').
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.deferredPrompt = e;
  if (typeof window.__onDeferredPrompt === 'function') window.__onDeferredPrompt(e);
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.warn('[Rio Flex PWA] Falha ao registrar Service Worker:', err);
    });
  });
}
