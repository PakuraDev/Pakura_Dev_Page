// Comments translated with AI

// La MSN del código, hacemos que sea compatible en varios navegadores aunque solo lo vaya a subir a firefox, simplemente porque puedo.
// Compatibility layer for WebExtensions API across browser environments.
const api = globalThis.browser || globalThis.chrome;

// Vigilamos la pestaña del pgn
// Listens for PGN export requests sent from content script.
api.runtime.onMessage.addListener((message) => {
  if (!message?.pgn) return;

  // Mandamos el pgn limpio de la basura que pone chess a la API de lichess.
  // Sends the sanitized PGN to Lichess official import API endpoint.
  fetch('https://lichess.org/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ pgn: message.pgn })
  })
    .then((res) => {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then((data) => {
      // PUM, la misma partida se abre en el análisis de lichess, para que después me digan de pagar
      // Opens the imported game directly in Lichess analysis board if API call succeeds.
      if (data?.url) {
        api.tabs.create({ url: data.url });
      } else {
        throw new Error();
      }
    })
    .catch(() => {
      // Por si acaso, aunque dudo que mi script falle jejejeje
      // Fallback: opens the direct analysis URL if the API request fails.
      api.tabs.create({ url: message.fallbackUrl || 'https://lichess.org/analysis' });
    });
});
