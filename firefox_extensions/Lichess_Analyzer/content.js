// Comments translated with AI

// // La BBC (bale benzema cristiano) del código, hacemos que sea compatible en varios navegadores aunque solo lo vaya a subir a firefox, simplemente porque puedo.
// Compatibility layer for WebExtensions API across browser environments.
const api = globalThis.browser || globalThis.chrome;

// Aquí empezamos con lo chungo, el parser con medidas extras por si algún psicopata tiene la opción de anotaciones de tiempo activa
// Parses and sanitizes raw PGN to ensure standard notation and remove clock annotations.
function cleanPgn(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  const headers = [];
  const moves = [];
  let inHeaders = true;

  for (const line of lines) {
    const t = line.trim();
    if (inHeaders && t.startsWith('[')) {
      headers.push(t);
    } else if (t) {
      inHeaders = false;
      moves.push(t);
    }
  }

  const cleanMoves = moves
    .join(' ')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\$\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return headers.length > 0 ? `${headers.join('\n')}\n\n${cleanMoves}` : cleanMoves;
}

// Y metemos el pgn directamente en la URL
// Encodes SAN move sequence into Lichess direct URL analysis format for fallback navigation.
function toLichessUrl(cleaned) {
  const parts = cleaned.split('\n\n');
  const moves = (parts.length > 1 ? parts[1] : parts[0])
    .replace(/(1-0|0-1|1\/2-1\/2|\*)$/, '')
    .trim()
    .replace(/(\d+)\.\s+/g, '$1.')
    .replace(/\s+/g, '_')
    .replace(/#/g, '%23');

  return moves ? `https://lichess.org/analysis/pgn/${moves}` : 'https://lichess.org/analysis';
}

// Metemos un okupa en el modal que permite irnos a un mejor lado
// Injects the 'Analyze on Lichess' button into the Chess.com PGN share tab.
function injectButton() {
  if (document.getElementById('lichess-analyzer-btn')) return;

  const textarea = document.querySelector('textarea.share-menu-tab-pgn-textarea');
  if (!textarea) return;

  const modal = textarea.closest('dialog, .cc-modal-component-v2, [role="dialog"]') || textarea.parentElement;
  const downloadBtn = modal?.querySelector('button.cc-button-primary, button[type="submit"], button.cc-button-component');

  const btn = document.createElement('button');
  btn.id = 'lichess-analyzer-btn';
  btn.className = 'lichess-analyzer-btn';
  btn.type = 'button';
  btn.innerHTML = `
    <svg class="lichess-analyzer-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 22H5v-2h14v2m-1-4H6c.1-2.2 1.3-4.1 3.2-5.1-.4-.8-.7-1.7-.7-2.7 0-1.8 1-3.4 2.5-4.2-.3-.6-.5-1.3-.5-2 0-2.2 1.8-4 4-4s4 1.8 4 4c0 .7-.2 1.4-.5 2 1.5.8 2.5 2.4 2.5 4.2 0 1-.3 1.9-.7 2.7 1.9 1 3.1 2.9 3.2 5.1z"/>
    </svg>
    <span>Analyze on Lichess</span>
  `;

  // Lo más sencillo del día, un listener del botón con "sanitizador" (no, no me acuerdo como se escribe)
  // Handles button click by sanitizing PGN from textarea and delegating import to background worker.
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = textarea.value.trim();
    if (raw) {
      const pgn = cleanPgn(raw);
      api.runtime.sendMessage({ pgn, fallbackUrl: toLichessUrl(pgn) });
    }
  });

  // Esto lo ha metido la IA, no sé que es, sinceramente. 
  // Positions the button directly above the default download button or inside the tab container.
  if (downloadBtn?.parentElement) {
    downloadBtn.parentElement.insertBefore(btn, downloadBtn);
  } else if (textarea.parentElement) {
    textarea.parentElement.appendChild(btn);
  }
}

// Observamos el DOM para ver si el usuario abre el modal con la ventana "pgn"
// Observes DOM tree changes to detect modal opening and tab switching dynamically.
const observer = new MutationObserver(injectButton);
observer.observe(document.body, { childList: true, subtree: true });
