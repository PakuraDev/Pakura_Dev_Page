/* =========================================
   PAKURA // KROMA STARTPAGE APP
   ========================================= */

(function () {
  'use strict';

  // --- CONFIGURACIÓN & LÍMITES ---
  const MAX_CATEGORIES = 4;
  const MAX_LINKS_PER_CAT = 4;
  const DEFAULT_SEARCH_URL = 'https://duckduckgo.com/?q=';

  // --- DATOS INICIALES PREDETERMINADOS ---
  const DEFAULT_CATEGORIES = [
    { id: 'cat-1', name: 'Categoría 1' },
    { id: 'cat-2', name: 'Categoría 2' },
    { id: 'cat-3', name: 'Categoría 3' },
    { id: 'cat-4', name: 'Categoría 4' }
  ];

  const DEFAULT_LINKS = [
    // Categoría 1
    { id: 'link-1', categoryId: 'cat-1', name: 'Enlace 1', url: 'https://github.com' },
    { id: 'link-2', categoryId: 'cat-1', name: 'Enlace 2', url: 'https://youtube.com' },
    { id: 'link-3', categoryId: 'cat-1', name: 'Enlace 3', url: 'https://reddit.com' },
    { id: 'link-4', categoryId: 'cat-1', name: 'Enlace 4', url: 'https://twitter.com' },
    // Categoría 2
    { id: 'link-5', categoryId: 'cat-2', name: 'Enlace 5', url: 'https://wikipedia.org' },
    { id: 'link-6', categoryId: 'cat-2', name: 'Enlace 6', url: 'https://duckduckgo.com' },
    { id: 'link-7', categoryId: 'cat-2', name: 'Enlace 7', url: 'https://figma.com' },
    { id: 'link-8', categoryId: 'cat-2', name: 'Enlace 8', url: 'https://notion.so' },
    // Categoría 3
    { id: 'link-9', categoryId: 'cat-3', name: 'Enlace 9', url: 'https://spotify.com' },
    { id: 'link-10', categoryId: 'cat-3', name: 'Enlace 10', url: 'https://twitch.tv' },
    { id: 'link-11', categoryId: 'cat-3', name: 'Enlace 11', url: 'https://stackoverflow.com' },
    { id: 'link-12', categoryId: 'cat-3', name: 'Enlace 12', url: 'https://developer.mozilla.org' },
    // Categoría 4
    { id: 'link-13', categoryId: 'cat-4', name: 'Enlace 13', url: 'https://dribbble.com' },
    { id: 'link-14', categoryId: 'cat-4', name: 'Enlace 14', url: 'https://behance.net' },
    { id: 'link-15', categoryId: 'cat-4', name: 'Enlace 15', url: 'https://news.ycombinator.com' },
    { id: 'link-16', categoryId: 'cat-4', name: 'Enlace 16', url: 'https://pakuradev.github.io/Pakura_Dev_Page/' }
  ];

  const DEFAULT_NOTES = {
    '1': { title: 'Nota 1', content: '' },
    '2': { title: 'Nota 2', content: '' },
    '3': { title: 'Nota 3', content: '' },
    '4': { title: 'Nota 4', content: '' },
    '5': { title: 'Nota 5', content: '' },
    '6': { title: 'Nota 6', content: '' }
  };

  // --- ESTADO GLOBAL ---
  let categories = loadData('kroma_categories', DEFAULT_CATEGORIES);
  let links = loadData('kroma_links', DEFAULT_LINKS);
  let notes = loadData('kroma_notes', DEFAULT_NOTES);
  let activeCategoryId = categories[0] ? categories[0].id : null;
  let activeNoteKey = null;
  let saveNoteTimeout = null;
  let contextTarget = null; // { type: 'category'|'link', id: string, categoryId?: string }

  // --- REFERENCIAS DEL DOM ---
  const searchInput = document.getElementById('searchInput');
  const categoriesHeader = document.getElementById('categoriesHeader');
  const linksGrid = document.getElementById('linksGrid');

  // Notas
  const notesGroup = document.getElementById('notesGroup');
  const notesPanel = document.getElementById('notesPanel');
  const noteBadge = document.getElementById('noteBadge');
  const noteTitle = document.getElementById('noteTitle');
  const noteTitleInput = document.getElementById('noteTitleInput');
  const noteContent = document.getElementById('noteContent');
  const helpContent = document.getElementById('helpContent');
  const btnCloseNotes = document.getElementById('btnCloseNotes');
  const saveStatus = document.getElementById('saveStatus');

  // Reloj
  const btnClockToggle = document.getElementById('btnClockToggle');
  const clockPanel = document.getElementById('clockPanel');
  const btnCloseClock = document.getElementById('btnCloseClock');
  const stopwatchDisplay = document.getElementById('stopwatchDisplay');
  const stopwatchProgressRing = document.getElementById('stopwatchProgressRing');
  const btnStopwatchStart = document.getElementById('btnStopwatchStart');
  const btnStopwatchReset = document.getElementById('btnStopwatchReset');
  const stopwatchWakeIndicator = document.getElementById('stopwatchWakeIndicator');

  // Temporizador
  const timerDisplay = document.getElementById('timerDisplay');
  const timerProgressRing = document.getElementById('timerProgressRing');
  const btnTimerStart = document.getElementById('btnTimerStart');
  const btnTimerReset = document.getElementById('btnTimerReset');
  const timerWakeIndicator = document.getElementById('timerWakeIndicator');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // Menú Contextual & Modales
  const contextMenu = document.getElementById('contextMenu');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const modalForm = document.getElementById('modalForm');
  const formGroupUrl = document.getElementById('formGroupUrl');
  const modalInputName = document.getElementById('modalInputName');
  const modalInputUrl = document.getElementById('modalInputUrl');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalConfirm = document.getElementById('btnModalConfirm');

  // --- PERSISTENCIA LOCALSTORAGE ---
  function loadData(key, fallback) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return JSON.parse(JSON.stringify(fallback));
  }

  function saveData(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  // =========================================
  // 1. BUSCADOR INTELIGENTE Y COMANDOS CLI
  // =========================================

  function executeSearch(query) {
    const raw = query.trim();
    if (!raw) return;

    const lower = raw.toLowerCase();

    // 1. Math Parser Seguro
    const isMath = /^[0-9+\-*/().\s]+$/.test(raw) && /[0-9]/.test(raw) && /[+\-*/]/.test(raw);
    if (isMath) {
      try {
        const result = new Function(`return ${raw}`)();
        if (result !== undefined && !isNaN(result) && result !== Infinity) {
          const finalResult = Number.isInteger(result) ? result : parseFloat(result.toFixed(4));
          searchInput.value = String(finalResult);
          searchInput.select();
          return;
        }
      } catch (_) {}
    }

    // 2. Comandos CLI
    if (lower.startsWith('/yt ')) {
      const term = raw.substring(4).trim();
      if (term) {
        window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`;
        return;
      }
    }

    if (lower.startsWith('/hex ')) {
      let hex = raw.substring(5).trim();
      if (hex.startsWith('#')) hex = hex.substring(1);
      if (hex) {
        window.location.href = `https://encycolorpedia.es/${encodeURIComponent(hex)}`;
        return;
      }
    }

    if (lower.startsWith('/svg ')) {
      const term = raw.substring(5).trim();
      if (term) {
        window.location.href = `https://www.svgrepo.com/vectors/${encodeURIComponent(term)}/`;
        return;
      }
    }

    if (lower.startsWith('/roll')) {
      const parts = raw.split(' ');
      let max = 100;
      if (parts.length > 1) {
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed > 0) max = parsed;
      }
      const roll = Math.floor(Math.random() * max) + 1;
      searchInput.value = `Kroma Roll: ${roll} / ${max}`;
      searchInput.select();
      return;
    }

    if (lower.startsWith('/choose ')) {
      const listStr = raw.substring(8).trim();
      if (listStr) {
        const options = listStr.split(',').map((o) => o.trim()).filter((o) => o.length > 0);
        if (options.length > 0) {
          const chosen = options[Math.floor(Math.random() * options.length)];
          searchInput.value = `Kroma elige: ${chosen}`;
          searchInput.select();
          return;
        }
      }
    }

    if (lower === '/export') {
      exportBackup();
      searchInput.value = '';
      return;
    }

    if (lower === '/import') {
      importBackup();
      searchInput.value = '';
      return;
    }

    if (lower === '/bento' || lower === '/home') {
      window.location.href = '../../index.html';
      return;
    }

    // Si parece una URL completa o dominio directo
    if (/^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i.test(raw)) {
      window.location.href = raw.startsWith('http') ? raw : `https://${raw}`;
      return;
    }

    // Búsqueda por defecto con DuckDuckGo
    window.location.href = DEFAULT_SEARCH_URL + encodeURIComponent(raw);
  }

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      executeSearch(searchInput.value);
    }
  });

  // =========================================
  // 2. RENDERIZADOR DE CATEGORÍAS Y ENLACES
  // =========================================

  function renderGrid() {
    categoriesHeader.innerHTML = '';
    linksGrid.innerHTML = '';

    if (!activeCategoryId && categories.length > 0) {
      activeCategoryId = categories[0].id;
    }

    categories.forEach((cat) => {
      // 1. Pestaña de Categoría
      const tab = document.createElement('div');
      tab.className = `category-tab ${cat.id === activeCategoryId ? 'active' : ''}`;
      tab.dataset.catId = cat.id;

      const title = document.createElement('h4');
      title.className = 'category-title';
      title.textContent = cat.name;

      const bar = document.createElement('div');
      bar.className = 'category-bar';

      tab.appendChild(title);
      tab.appendChild(bar);

      tab.addEventListener('click', () => {
        activeCategoryId = cat.id;
        renderGrid();
      });

      // Clic derecho en Categoría
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openContextMenu(e, 'category', cat.id);
      });

      categoriesHeader.appendChild(tab);

      // 2. Columna de Enlaces
      const column = document.createElement('div');
      column.className = 'links-column';
      column.dataset.catId = cat.id;

      const catLinks = links.filter((l) => l.categoryId === cat.id);

      catLinks.forEach((link) => {
        const linkEl = document.createElement('a');
        linkEl.className = 'link-item';
        linkEl.textContent = link.name;
        linkEl.href = link.url;
        linkEl.target = '_self';
        linkEl.dataset.linkId = link.id;

        // Clic derecho en Enlace
        linkEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openContextMenu(e, 'link', link.id, cat.id);
        });

        column.appendChild(linkEl);
      });

      linksGrid.appendChild(column);
    });
  }

  // =========================================
  // 3. MENÚ CONTEXTUAL Y ACCIONES
  // =========================================

  function openContextMenu(e, type, id, categoryId) {
    contextTarget = { type, id, categoryId };
    contextMenu.innerHTML = '';

    if (type === 'category') {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;

      // Renombrar
      addContextMenuItem('Cambiar nombre', () => openRenameCategoryModal(cat));

      // Crear nueva categoría (si hay menos del máximo)
      if (categories.length < MAX_CATEGORIES) {
        addContextMenuItem('Crear nueva categoría', () => openCreateCategoryModal());
      }

      // Borrar categoría
      addContextMenuItem('Borrar categoría', () => openDeleteCategoryModal(cat), true);

      // Restablecer
      addContextMenuItem('Restablecer todo', () => openResetAllModal());
    } else if (type === 'link') {
      const link = links.find((l) => l.id === id);
      if (!link) return;

      const catLinks = links.filter((l) => l.categoryId === categoryId);

      // Editar
      addContextMenuItem('Editar enlace', () => openEditLinkModal(link));

      // Añadir enlace en la columna
      if (catLinks.length < MAX_LINKS_PER_CAT) {
        addContextMenuItem('Añadir enlace', () => openCreateLinkModal(categoryId));
      }

      // Borrar enlace / Borrar fila
      const isLastInCol = catLinks.length === 1;
      const deleteLabel = isLastInCol ? 'Borrar fila' : 'Borrar enlace';
      addContextMenuItem(deleteLabel, () => deleteLink(link.id), true);

      // Restablecer
      addContextMenuItem('Restablecer enlaces', () => openResetLinksModal());
    }

    // Posicionamiento inteligente del menú
    contextMenu.classList.add('show');
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
  }

  function addContextMenuItem(label, onClick, isDanger = false) {
    const item = document.createElement('button');
    item.className = `context-menu-item ${isDanger ? 'danger' : ''}`;
    item.textContent = label;
    item.addEventListener('click', () => {
      closeContextMenu();
      onClick();
    });
    contextMenu.appendChild(item);
  }

  function closeContextMenu() {
    contextMenu.classList.remove('show');
  }

  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      closeContextMenu();
    }
  });

  // =========================================
  // 4. MODALES DE CONFIRMACIÓN Y EDICIÓN
  // =========================================

  let modalConfirmCallback = null;

  function showModal({ title, desc, showForm = false, showUrl = false, nameVal = '', urlVal = '', isDanger = false, onConfirm }) {
    modalTitle.textContent = title;
    modalDesc.textContent = desc;

    if (showForm) {
      modalForm.style.display = 'flex';
      modalInputName.value = nameVal;
      formGroupUrl.style.display = showUrl ? 'flex' : 'none';
      modalInputUrl.value = urlVal;
    } else {
      modalForm.style.display = 'none';
    }

    btnModalConfirm.className = `btn-modal btn-confirm ${isDanger ? 'danger' : ''}`;
    modalConfirmCallback = onConfirm;

    modalBackdrop.classList.add('show');
    if (showForm) {
      setTimeout(() => modalInputName.focus(), 100);
    }
  }

  function closeModal() {
    modalBackdrop.classList.remove('show');
    modalConfirmCallback = null;
  }

  btnModalCancel.addEventListener('click', closeModal);
  btnModalConfirm.addEventListener('click', () => {
    if (modalConfirmCallback) {
      modalConfirmCallback({
        name: modalInputName.value.trim(),
        url: modalInputUrl.value.trim()
      });
    }
    closeModal();
  });

  // Acciones de Categorías
  function openRenameCategoryModal(cat) {
    showModal({
      title: 'Cambiar nombre de categoría',
      desc: 'Introduce el nuevo nombre para esta categoría:',
      showForm: true,
      nameVal: cat.name,
      onConfirm: ({ name }) => {
        if (name) {
          cat.name = name;
          saveData('kroma_categories', categories);
          renderGrid();
        }
      }
    });
  }

  function openCreateCategoryModal() {
    showModal({
      title: 'Nueva categoría',
      desc: 'Introduce el nombre para la nueva categoría:',
      showForm: true,
      nameVal: `Categoría ${categories.length + 1}`,
      onConfirm: ({ name }) => {
        if (name && categories.length < MAX_CATEGORIES) {
          const newId = `cat-${Date.now()}`;
          categories.push({ id: newId, name });
          // Añadir al menos un enlace por defecto
          links.push({
            id: `link-${Date.now()}`,
            categoryId: newId,
            name: 'Nuevo Enlace',
            url: 'https://duckduckgo.com'
          });
          saveData('kroma_categories', categories);
          saveData('kroma_links', links);
          activeCategoryId = newId;
          renderGrid();
        }
      }
    });
  }

  function openDeleteCategoryModal(cat) {
    showModal({
      title: '¿Borrar categoría?',
      desc: `Se eliminará "${cat.name}" y todos sus enlaces asociados. Esta acción no se puede deshacer.`,
      isDanger: true,
      onConfirm: () => {
        categories = categories.filter((c) => c.id !== cat.id);
        links = links.filter((l) => l.categoryId !== cat.id);
        if (activeCategoryId === cat.id) {
          activeCategoryId = categories[0] ? categories[0].id : null;
        }
        saveData('kroma_categories', categories);
        saveData('kroma_links', links);
        renderGrid();
      }
    });
  }

  // Acciones de Enlaces
  function openEditLinkModal(link) {
    showModal({
      title: 'Editar enlace',
      desc: 'Modifica el nombre y la dirección de destino:',
      showForm: true,
      showUrl: true,
      nameVal: link.name,
      urlVal: link.url,
      onConfirm: ({ name, url }) => {
        if (name) link.name = name;
        if (url) {
          link.url = url.startsWith('http') ? url : `https://${url}`;
        }
        saveData('kroma_links', links);
        renderGrid();
      }
    });
  }

  function openCreateLinkModal(categoryId) {
    showModal({
      title: 'Añadir enlace',
      desc: 'Introduce el nombre y la URL del nuevo enlace:',
      showForm: true,
      showUrl: true,
      nameVal: 'Nuevo Enlace',
      urlVal: 'https://',
      onConfirm: ({ name, url }) => {
        if (name && url) {
          links.push({
            id: `link-${Date.now()}`,
            categoryId,
            name,
            url: url.startsWith('http') ? url : `https://${url}`
          });
          saveData('kroma_links', links);
          renderGrid();
        }
      }
    });
  }

  function deleteLink(linkId) {
    links = links.filter((l) => l.id !== linkId);
    saveData('kroma_links', links);
    renderGrid();
  }

  function openResetAllModal() {
    showModal({
      title: '¿Restablecer todo?',
      desc: 'Se restaurarán todas las categorías y enlaces por defecto.',
      isDanger: true,
      onConfirm: () => {
        categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        links = JSON.parse(JSON.stringify(DEFAULT_LINKS));
        activeCategoryId = categories[0].id;
        saveData('kroma_categories', categories);
        saveData('kroma_links', links);
        renderGrid();
      }
    });
  }

  function openResetLinksModal() {
    showModal({
      title: '¿Restablecer enlaces?',
      desc: 'Se restaurarán los enlaces por defecto.',
      isDanger: true,
      onConfirm: () => {
        links = JSON.parse(JSON.stringify(DEFAULT_LINKS));
        saveData('kroma_links', links);
        renderGrid();
      }
    });
  }

  // =========================================
  // 5. PANEL DE NOTAS & GUÍA DE AYUDA (?)
  // =========================================

  const HELP_GUIDE_HTML = `
    <h6>Comandos del Buscador</h6>
    <ul>
      <li><code>25 * 4 + 10</code> → Calculadora matemática instantánea</li>
      <li><code>/yt [término]</code> → Buscar en YouTube</li>
      <li><code>/hex [código]</code> → Buscar color en Encycolorpedia</li>
      <li><code>/svg [icono]</code> → Buscar iconos en SVGRepo</li>
      <li><code>/roll [máx]</code> → Tirada de dado aleatoria (por defecto 100)</li>
      <li><code>/choose a, b, c</code> → Elección aleatoria entre opciones</li>
      <li><code>/export</code> → Descargar copia de seguridad JSON</li>
      <li><code>/import</code> → Cargar copia de seguridad JSON</li>
      <li><code>/bento</code> → Volver a la página principal del Bento</li>
    </ul>

    <h6>Controles con Clic Derecho</h6>
    <ul>
      <li><strong>Sobre una Categoría:</strong> Cambiar nombre, crear nueva, borrar y restablecer.</li>
      <li><strong>Sobre un Enlace:</strong> Editar nombre/URL, añadir nuevo, borrar y restablecer.</li>
    </ul>

    <h6>Cronómetro y Temporizador</h6>
    <ul>
      <li>Usa el botón de reloj en la esquina inferior derecha.</li>
      <li>Mantiene la pantalla encendida automáticamente mientras esté activo (Screen Wake Lock API).</li>
    </ul>
  `;

  function openNote(key) {
    activeNoteKey = key;
    document.querySelectorAll('.note-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.note === key);
    });

    closeClockPanel();
    notesPanel.classList.add('open');

    if (key === 'help') {
      noteBadge.textContent = '?';
      noteTitle.textContent = 'Comandos y Controles';
      noteContent.style.display = 'none';
      helpContent.style.display = 'block';
      helpContent.innerHTML = HELP_GUIDE_HTML;
      saveStatus.textContent = 'Guía de referencia (Solo lectura)';
    } else {
      if (!notes[key]) {
        notes[key] = { title: `Nota ${key}`, content: '' };
      }
      noteBadge.textContent = key;
      noteTitle.textContent = notes[key].title || `Nota ${key}`;
      noteContent.style.display = 'block';
      helpContent.style.display = 'none';
      noteContent.value = notes[key].content || '';
      saveStatus.textContent = 'Guardado automáticamente';
      noteContent.focus();
    }
  }

  function closeNotesPanel() {
    notesPanel.classList.remove('open');
    activeNoteKey = null;
    document.querySelectorAll('.note-btn').forEach((b) => b.classList.remove('active'));
  }

  notesGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.note-btn');
    if (!btn) return;
    const noteKey = btn.dataset.note;
    if (activeNoteKey === noteKey) {
      closeNotesPanel();
    } else {
      openNote(noteKey);
    }
  });

  btnCloseNotes.addEventListener('click', closeNotesPanel);

  // Auto-guardado con Debounce (1 segundo de inactividad)
  noteContent.addEventListener('input', () => {
    if (!activeNoteKey || activeNoteKey === 'help') return;
    saveStatus.textContent = 'Guardando...';
    clearTimeout(saveNoteTimeout);
    saveNoteTimeout = setTimeout(() => {
      if (notes[activeNoteKey]) {
        notes[activeNoteKey].content = noteContent.value;
        saveData('kroma_notes', notes);
        saveStatus.textContent = 'Guardado automáticamente';
      }
    }, 1000);
  });

  // Edición de título de la nota al doble clic
  noteTitle.addEventListener('dblclick', () => {
    if (activeNoteKey === 'help') return;
    noteTitle.style.display = 'none';
    noteTitleInput.style.display = 'block';
    noteTitleInput.value = noteTitle.textContent;
    noteTitleInput.focus();
    noteTitleInput.select();
  });

  function saveNoteTitle() {
    if (!activeNoteKey || activeNoteKey === 'help') return;
    const newTitle = noteTitleInput.value.trim() || `Nota ${activeNoteKey}`;
    noteTitle.textContent = newTitle;
    noteTitle.style.display = 'block';
    noteTitleInput.style.display = 'none';
    if (notes[activeNoteKey]) {
      notes[activeNoteKey].title = newTitle;
      saveData('kroma_notes', notes);
    }
  }

  noteTitleInput.addEventListener('blur', saveNoteTitle);
  noteTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveNoteTitle();
  });

  // =========================================
  // 6. RELOJ, CRONÓMETRO, TEMPORIZADOR & WAKE LOCK
  // =========================================

  let wakeLock = null;

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        if (!wakeLock) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => {
            wakeLock = null;
            updateWakeIndicators();
          });
          updateWakeIndicators();
        }
      } catch (err) {
        console.warn('[Kroma] Wake Lock error:', err);
      }
    }
  }

  function releaseWakeLockIfIdle() {
    if (!isStopwatchRunning && !isTimerRunning && wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
      updateWakeIndicators();
    }
  }

  function updateWakeIndicators() {
    const active = wakeLock !== null;
    stopwatchWakeIndicator.classList.toggle('active', active && isStopwatchRunning);
    timerWakeIndicator.classList.toggle('active', active && isTimerRunning);
  }

  function playAlertBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota A5
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (_) {}
  }

  // --- CRONÓMETRO ---
  const RING_CIRCUMFERENCE = 440; // 2 * PI * 70 approx
  let isStopwatchRunning = false;
  let stopwatchStartTime = 0;
  let stopwatchElapsedTime = 0;
  let stopwatchRafId = null;

  function updateStopwatch() {
    const now = performance.now();
    const totalMs = stopwatchElapsedTime + (now - stopwatchStartTime);

    const ms = Math.floor((totalMs % 1000) / 10);
    const secs = Math.floor((totalMs / 1000) % 60);
    const mins = Math.floor((totalMs / (1000 * 60)) % 60);

    const minsStr = String(mins).padStart(2, '0');
    const secsStr = String(secs).padStart(2, '0');
    const msStr = String(ms).padStart(2, '0');

    stopwatchDisplay.textContent = `${minsStr}:${secsStr}.${msStr}`;

    // Progreso continuo del anillo (1 vuelta completa cada 60s)
    const fraction = ((totalMs % 60000) / 60000);
    const offset = RING_CIRCUMFERENCE * (1 - fraction);
    if (stopwatchProgressRing) {
      stopwatchProgressRing.style.strokeDashoffset = offset;
    }

    if (isStopwatchRunning) {
      stopwatchRafId = requestAnimationFrame(updateStopwatch);
    }
  }

  btnStopwatchStart.addEventListener('click', async () => {
    if (isStopwatchRunning) {
      // Pausar
      isStopwatchRunning = false;
      cancelAnimationFrame(stopwatchRafId);
      stopwatchElapsedTime += performance.now() - stopwatchStartTime;
      btnStopwatchStart.textContent = 'Continuar';
      releaseWakeLockIfIdle();
    } else {
      // Iniciar
      isStopwatchRunning = true;
      stopwatchStartTime = performance.now();
      btnStopwatchStart.textContent = 'Pausar';
      await requestWakeLock();
      updateStopwatch();
    }
  });

  btnStopwatchReset.addEventListener('click', () => {
    isStopwatchRunning = false;
    cancelAnimationFrame(stopwatchRafId);
    stopwatchElapsedTime = 0;
    stopwatchDisplay.textContent = '00:00.00';
    if (stopwatchProgressRing) {
      stopwatchProgressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
    }
    btnStopwatchStart.textContent = 'Iniciar';
    releaseWakeLockIfIdle();
  });

  // --- TEMPORIZADOR ---
  let timerDurationSecs = 25 * 60;
  let timerRemainingSecs = timerDurationSecs;
  let isTimerRunning = false;
  let timerIntervalId = null;

  function updateTimerDisplay() {
    const mins = Math.floor(timerRemainingSecs / 60);
    const secs = timerRemainingSecs % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const fraction = timerDurationSecs > 0 ? timerRemainingSecs / timerDurationSecs : 0;
    const offset = RING_CIRCUMFERENCE * (1 - fraction);
    timerProgressRing.style.strokeDashoffset = offset;
  }

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isTimerRunning) return;
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mins = parseInt(btn.dataset.minutes, 10);
      timerDurationSecs = mins * 60;
      timerRemainingSecs = timerDurationSecs;
      updateTimerDisplay();
    });
  });

  btnTimerStart.addEventListener('click', async () => {
    if (isTimerRunning) {
      // Pausar
      isTimerRunning = false;
      clearInterval(timerIntervalId);
      btnTimerStart.textContent = 'Continuar';
      releaseWakeLockIfIdle();
    } else {
      if (timerRemainingSecs <= 0) {
        timerRemainingSecs = timerDurationSecs;
      }
      isTimerRunning = true;
      btnTimerStart.textContent = 'Pausar';
      await requestWakeLock();

      timerIntervalId = setInterval(() => {
        timerRemainingSecs--;
        updateTimerDisplay();

        if (timerRemainingSecs <= 0) {
          clearInterval(timerIntervalId);
          isTimerRunning = false;
          btnTimerStart.textContent = 'Iniciar';
          playAlertBeep();
          releaseWakeLockIfIdle();
        }
      }, 1000);
    }
  });

  btnTimerReset.addEventListener('click', () => {
    isTimerRunning = false;
    clearInterval(timerIntervalId);
    timerRemainingSecs = timerDurationSecs;
    btnTimerStart.textContent = 'Iniciar';
    updateTimerDisplay();
    releaseWakeLockIfIdle();
  });

  // Toggle panel reloj
  function openClockPanel() {
    closeNotesPanel();
    clockPanel.classList.add('open');
    btnClockToggle.classList.add('active');
  }

  function closeClockPanel() {
    clockPanel.classList.remove('open');
    btnClockToggle.classList.remove('active');
  }

  btnClockToggle.addEventListener('click', () => {
    if (clockPanel.classList.contains('open')) {
      closeClockPanel();
    } else {
      openClockPanel();
    }
  });

  btnCloseClock.addEventListener('click', closeClockPanel);

  // =========================================
  // 7. BACKUP IMPORT / EXPORT
  // =========================================

  function exportBackup() {
    const data = {
      categories,
      links,
      notes,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kroma_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.categories && Array.isArray(data.categories)) {
          categories = data.categories;
          saveData('kroma_categories', categories);
        }
        if (data.links && Array.isArray(data.links)) {
          links = data.links;
          saveData('kroma_links', links);
        }
        if (data.notes && typeof data.notes === 'object') {
          notes = data.notes;
          saveData('kroma_notes', notes);
        }

        renderGrid();
        alert('✅ Configuración importada con éxito.');
      } catch (err) {
        alert('❌ Error al importar archivo JSON: ' + err.message);
      }
    });

    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  }

  // =========================================
  // 8. INICIALIZACIÓN
  // =========================================

  function init() {
    renderGrid();
    updateTimerDisplay();
  }

  init();
})();
