/* =========================================
   PAKURA // KROMA STARTPAGE APP
   ========================================= */

(function () {
  'use strict';

  // --- CONFIGURACIÓN & LÍMITES ---
  const MAX_CATEGORIES = 4;
  const MAX_COLUMNS_PER_CAT = 4;
  const MAX_LINKS_PER_COL = 4;
  const DEFAULT_SEARCH_URL = 'https://duckduckgo.com/?q=';

  // --- DATOS INICIALES PREDETERMINADOS (4 Categorías × 4 Columnas × 4 Enlaces) ---
  function createDefaultColumns(prefix) {
    return [
      [
        { id: `${prefix}-l1`, name: 'Enlace 1', url: 'https://github.com' },
        { id: `${prefix}-l2`, name: 'Enlace 2', url: 'https://youtube.com' },
        { id: `${prefix}-l3`, name: 'Enlace 3', url: 'https://reddit.com' },
        { id: `${prefix}-l4`, name: 'Enlace 4', url: 'https://twitter.com' }
      ],
      [
        { id: `${prefix}-l5`, name: 'Enlace 5', url: 'https://wikipedia.org' },
        { id: `${prefix}-l6`, name: 'Enlace 6', url: 'https://duckduckgo.com' },
        { id: `${prefix}-l7`, name: 'Enlace 7', url: 'https://figma.com' },
        { id: `${prefix}-l8`, name: 'Enlace 8', url: 'https://notion.so' }
      ],
      [
        { id: `${prefix}-l9`, name: 'Enlace 9', url: 'https://spotify.com' },
        { id: `${prefix}-l10`, name: 'Enlace 10', url: 'https://twitch.tv' },
        { id: `${prefix}-l11`, name: 'Enlace 11', url: 'https://stackoverflow.com' },
        { id: `${prefix}-l12`, name: 'Enlace 12', url: 'https://developer.mozilla.org' }
      ],
      [
        { id: `${prefix}-l13`, name: 'Enlace 13', url: 'https://dribbble.com' },
        { id: `${prefix}-l14`, name: 'Enlace 14', url: 'https://behance.net' },
        { id: `${prefix}-l15`, name: 'Enlace 15', url: 'https://news.ycombinator.com' },
        { id: `${prefix}-l16`, name: 'Enlace 16', url: 'https://pakura.dev' }
      ]
    ];
  }

  const DEFAULT_CATEGORIES = [
    { id: 'cat-1', name: 'Categoría 1', columns: createDefaultColumns('c1') },
    { id: 'cat-2', name: 'Categoría 2', columns: createDefaultColumns('c2') },
    { id: 'cat-3', name: 'Categoría 3', columns: createDefaultColumns('c3') },
    { id: 'cat-4', name: 'Categoría 4', columns: createDefaultColumns('c4') }
  ];

  const DEFAULT_NOTES = {
    '1': { title: 'Nota 1', content: '' },
    '2': { title: 'Nota 2', content: '' },
    '3': { title: 'Nota 3', content: '' },
    '4': { title: 'Nota 4', content: '' },
    '5': { title: 'Nota 5', content: '' },
    '6': { title: 'Nota 6', content: '' }
  };

  // --- PERSISTENCIA LOCALSTORAGE & MIGRACIÓN ---
  function loadCategories() {
    try {
      const stored = localStorage.getItem('kroma_categories_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0].columns)) {
          return parsed;
        }
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  }

  function saveCategories(cats) {
    try {
      localStorage.setItem('kroma_categories_v2', JSON.stringify(cats));
    } catch (_) {}
  }

  function loadNotes() {
    try {
      const stored = localStorage.getItem('kroma_notes');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_NOTES));
  }

  function saveNotes(nts) {
    try {
      localStorage.setItem('kroma_notes', JSON.stringify(nts));
    } catch (_) {}
  }

  // --- ESTADO GLOBAL ---
  let categories = loadCategories();
  let notes = loadNotes();
  let activeCategoryId = categories[0] ? categories[0].id : null;
  let activeNoteKey = null;
  let saveNoteTimeout = null;

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

    // Asegurar que activeCategoryId apunte a una categoría existente
    let activeCat = categories.find((c) => c.id === activeCategoryId);
    if (!activeCat && categories.length > 0) {
      activeCat = categories[0];
      activeCategoryId = activeCat.id;
    }

    // 1. Renderizar Pestañas de Categoría superiores
    categories.forEach((cat) => {
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

      // Clic para cambiar de categoría
      tab.addEventListener('click', () => {
        activeCategoryId = cat.id;
        renderGrid();
      });

      // Clic derecho en Categoría
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openCategoryContextMenu(e, cat);
      });

      categoriesHeader.appendChild(tab);
    });

    // 2. Renderizar Columnas / Filas de enlaces de la categoría ACTIVA
    if (activeCat && Array.isArray(activeCat.columns)) {
      activeCat.columns.forEach((columnLinks, colIndex) => {
        const column = document.createElement('div');
        column.className = 'links-column';
        column.dataset.colIndex = colIndex;

        columnLinks.forEach((link, linkIndex) => {
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
            openLinkContextMenu(e, activeCat, colIndex, linkIndex);
          });

          column.appendChild(linkEl);
        });

        // Si la columna está vacía, permitir clic derecho para añadir
        column.addEventListener('contextmenu', (e) => {
          if (e.target === column) {
            e.preventDefault();
            openColumnContextMenu(e, activeCat, colIndex);
          }
        });

        linksGrid.appendChild(column);
      });
    }
  }

  // =========================================
  // 3. MENÚ CONTEXTUAL SIN EMOJIS
  // =========================================

  function openCategoryContextMenu(e, cat) {
    contextMenu.innerHTML = '';

    // Renombrar
    addContextMenuItem('Cambiar nombre', () => openRenameCategoryModal(cat));

    // Crear nueva categoría (si hay menos de 4)
    if (categories.length < MAX_CATEGORIES) {
      addContextMenuItem('Crear nueva categoría', () => openCreateCategoryModal());
    }

    // Borrar categoría
    addContextMenuItem('Borrar categoría', () => openDeleteCategoryModal(cat), true);

    // Restablecer todo
    addContextMenuItem('Restablecer todo', () => openResetAllModal());

    showContextMenu(e);
  }

  function openLinkContextMenu(e, cat, colIndex, linkIndex) {
    contextMenu.innerHTML = '';

    const column = cat.columns[colIndex];
    const link = column[linkIndex];
    if (!link) return;

    // Editar enlace
    addContextMenuItem('Editar enlace', () => openEditLinkModal(cat, colIndex, linkIndex));

    // Añadir enlace en esta columna (si hay < 4)
    if (column.length < MAX_LINKS_PER_COL) {
      addContextMenuItem('Añadir enlace', () => openCreateLinkModal(cat, colIndex));
    }

    // Crear nueva fila/columna (si la categoría tiene < 4 columnas)
    if (cat.columns.length < MAX_COLUMNS_PER_CAT) {
      addContextMenuItem('Crear fila', () => createColumn(cat));
    }

    // Borrar enlace / Borrar fila
    if (column.length === 1) {
      addContextMenuItem('Borrar fila', () => deleteColumn(cat, colIndex), true);
    } else {
      addContextMenuItem('Borrar enlace', () => deleteLink(cat, colIndex, linkIndex), true);
    }

    // Restablecer enlaces de esta categoría
    addContextMenuItem('Restablecer enlaces', () => openResetCategoryLinksModal(cat));

    showContextMenu(e);
  }

  function openColumnContextMenu(e, cat, colIndex) {
    contextMenu.innerHTML = '';
    const column = cat.columns[colIndex];

    if (column.length < MAX_LINKS_PER_COL) {
      addContextMenuItem('Añadir enlace', () => openCreateLinkModal(cat, colIndex));
    }
    if (cat.columns.length < MAX_COLUMNS_PER_CAT) {
      addContextMenuItem('Crear fila', () => createColumn(cat));
    }
    addContextMenuItem('Borrar fila', () => deleteColumn(cat, colIndex), true);

    showContextMenu(e);
  }

  function showContextMenu(e) {
    contextMenu.classList.add('show');
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 220);
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
          saveCategories(categories);
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
          categories.push({
            id: newId,
            name,
            columns: createDefaultColumns(`c${categories.length + 1}`)
          });
          saveCategories(categories);
          activeCategoryId = newId;
          renderGrid();
        }
      }
    });
  }

  function openDeleteCategoryModal(cat) {
    showModal({
      title: '¿Borrar categoría?',
      desc: `Se eliminará "${cat.name}" y todas sus filas de enlaces asociadas.`,
      isDanger: true,
      onConfirm: () => {
        categories = categories.filter((c) => c.id !== cat.id);
        if (activeCategoryId === cat.id) {
          activeCategoryId = categories[0] ? categories[0].id : null;
        }
        saveCategories(categories);
        renderGrid();
      }
    });
  }

  // Acciones de Enlaces y Columnas
  function openEditLinkModal(cat, colIndex, linkIndex) {
    const link = cat.columns[colIndex][linkIndex];
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
        saveCategories(categories);
        renderGrid();
      }
    });
  }

  function openCreateLinkModal(cat, colIndex) {
    showModal({
      title: 'Añadir enlace',
      desc: 'Introduce el nombre y la URL del nuevo enlace:',
      showForm: true,
      showUrl: true,
      nameVal: 'Nuevo Enlace',
      urlVal: 'https://',
      onConfirm: ({ name, url }) => {
        if (name && url) {
          cat.columns[colIndex].push({
            id: `link-${Date.now()}`,
            name,
            url: url.startsWith('http') ? url : `https://${url}`
          });
          saveCategories(categories);
          renderGrid();
        }
      }
    });
  }

  function deleteLink(cat, colIndex, linkIndex) {
    cat.columns[colIndex].splice(linkIndex, 1);
    saveCategories(categories);
    renderGrid();
  }

  function createColumn(cat) {
    if (cat.columns.length < MAX_COLUMNS_PER_CAT) {
      cat.columns.push([
        {
          id: `link-${Date.now()}`,
          name: 'Nuevo Enlace',
          url: 'https://duckduckgo.com'
        }
      ]);
      saveCategories(categories);
      renderGrid();
    }
  }

  function deleteColumn(cat, colIndex) {
    cat.columns.splice(colIndex, 1);
    saveCategories(categories);
    renderGrid();
  }

  function openResetCategoryLinksModal(cat) {
    showModal({
      title: '¿Restablecer enlaces de esta categoría?',
      desc: `Se restablecerán las 4 filas de enlaces de "${cat.name}".`,
      isDanger: true,
      onConfirm: () => {
        cat.columns = createDefaultColumns(cat.id);
        saveCategories(categories);
        renderGrid();
      }
    });
  }

  function openResetAllModal() {
    showModal({
      title: '¿Restablecer todo?',
      desc: 'Se restaurarán todas las categorías y enlaces por defecto.',
      isDanger: true,
      onConfirm: () => {
        categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        activeCategoryId = categories[0].id;
        saveCategories(categories);
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
        saveNotes(notes);
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
      saveNotes(notes);
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
          saveCategories(categories);
        }
        if (data.notes && typeof data.notes === 'object') {
          notes = data.notes;
          saveNotes(notes);
        }

        renderGrid();
        alert('Configuración importada con éxito.');
      } catch (err) {
        alert('Error al importar archivo JSON: ' + err.message);
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
