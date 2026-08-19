/* =========================================
   PAKURA // MESH GRADIENT GENERATOR
   ========================================= */

(function () {
  'use strict';

  // --- CONFIGURACIÓN & LÍMITES ---
  const CANVAS_SIZE = 600;
  const MIN_COLORS = 2;
  const MAX_COLORS = 5;
  const MAX_HISTORY = 6;
  const DEFAULT_COLORS = ['#A1FCC0', '#CFE26A', '#6FBBEE', '#D76BF5'];
  const HISTORY_DEBOUNCE_MS = 600;

  // --- ELEMENTOS DEL DOM ---
  const meshCanvas = document.getElementById('meshCanvas');
  const meshCtx = meshCanvas.getContext('2d', { willReadFrequently: true });

  const inputSeed = document.getElementById('inputSeed');
  const btnRandomSeed = document.getElementById('btnRandomSeed');
  const btnDownload = document.getElementById('btnDownload');

  const colorsList = document.getElementById('colorsList');
  const addColorCard = document.getElementById('addColorCard');
  const newColorPicker = document.getElementById('newColorPicker');
  const newColorPreview = document.getElementById('newColorPreview');
  const inputNewColor = document.getElementById('inputNewColor');
  const btnRandomNewColor = document.getElementById('btnRandomNewColor');
  const btnAddColor = document.getElementById('btnAddColor');

  const sliderComplexity = document.getElementById('sliderComplexity');
  const valComplexity = document.getElementById('valComplexity');
  const sliderBlur = document.getElementById('sliderBlur');
  const valBlur = document.getElementById('valBlur');
  const sliderNoise = document.getElementById('sliderNoise');
  const valNoise = document.getElementById('valNoise');

  const historyGrid = document.getElementById('historyGrid');

  // --- ESTADO ---
  let colors = loadSavedColors();
  let historyEntries = [];
  let historyTimer = null;
  let suppressHistory = false;

  // --- LOCALSTORAGE ---
  function saveColors() {
    try {
      localStorage.setItem('pakura_mesh_colors', JSON.stringify(colors));
    } catch (_) {}
  }

  function loadSavedColors() {
    try {
      const stored = localStorage.getItem('pakura_mesh_colors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= MIN_COLORS && parsed.length <= MAX_COLORS) {
          return parsed;
        }
      }
    } catch (_) {}
    return [...DEFAULT_COLORS];
  }

  // --- PRNG CON SEMILLA (xmur3 + mulberry32) ---
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateRandomHex() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
  }

  function generateRandomSeed() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  function normalizeHex(hex) {
    if (!hex) return '';
    hex = hex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return hex.toUpperCase();
    }
    return '';
  }

  // --- MOTOR DE DIBUJO ---
  function renderMesh() {
    const seedText = inputSeed.value.trim() || '00000000';
    const complexity = parseInt(sliderComplexity.value, 10) || 6;
    const blurAmount = parseInt(sliderBlur.value, 10) || 0;
    const noiseAmount = (parseInt(sliderNoise.value, 10) || 0) / 100;

    const seedGen = xmur3(seedText);
    const rand = mulberry32(seedGen());

    meshCtx.filter = 'none';
    meshCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Fondo base con el primer color
    meshCtx.fillStyle = colors[0] || '#1a1a1a';
    meshCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Aplicar desenfoque para los círculos
    meshCtx.filter = blurAmount > 0 ? `blur(${blurAmount}px)` : 'none';

    for (let i = 0; i < complexity; i++) {
      const x = rand() * (CANVAS_SIZE + 200) - 100;
      const y = rand() * (CANVAS_SIZE + 200) - 100;
      const radius = rand() * 350 + 100;
      const colorIndex = Math.floor(rand() * colors.length);

      meshCtx.beginPath();
      meshCtx.arc(x, y, radius, 0, Math.PI * 2);
      meshCtx.fillStyle = colors[colorIndex] || colors[0];
      meshCtx.fill();
    }

    // Efecto de ruido
    if (noiseAmount > 0) {
      meshCtx.filter = 'none';
      const imgData = meshCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (rand() - 0.5) * 255 * noiseAmount;
        data[i] += noise;
        data[i + 1] += noise;
        data[i + 2] += noise;
      }
      meshCtx.putImageData(imgData, 0, 0);
    }
  }

  function triggerUpdate() {
    renderMesh();
    if (!suppressHistory) {
      clearTimeout(historyTimer);
      historyTimer = setTimeout(captureHistory, HISTORY_DEBOUNCE_MS);
    }
  }

  // --- HISTORIAL ---
  function captureHistory() {
    const currentEntry = {
      thumbnail: meshCanvas.toDataURL('image/png', 0.5),
      seed: inputSeed.value.trim() || '00000000',
      colors: [...colors],
      complexity: sliderComplexity.value,
      blur: sliderBlur.value,
      noise: sliderNoise.value
    };

    // Evitar duplicados seguidos exactos
    if (historyEntries.length > 0) {
      const last = historyEntries[0];
      if (
        last.seed === currentEntry.seed &&
        last.complexity === currentEntry.complexity &&
        last.blur === currentEntry.blur &&
        last.noise === currentEntry.noise &&
        JSON.stringify(last.colors) === JSON.stringify(currentEntry.colors)
      ) {
        return;
      }
    }

    historyEntries.unshift(currentEntry);
    if (historyEntries.length > MAX_HISTORY) {
      historyEntries.length = MAX_HISTORY;
    }
    renderHistoryUI();
  }

  function restoreHistory(index) {
    const entry = historyEntries[index];
    if (!entry) return;

    suppressHistory = true;

    inputSeed.value = entry.seed;
    colors = [...entry.colors];
    sliderComplexity.value = entry.complexity;
    sliderBlur.value = entry.blur;
    sliderNoise.value = entry.noise;

    updateSliderValues();
    updateSliderTracks();
    saveColors();
    renderColorsList();
    renderMesh();

    suppressHistory = false;
  }

  function renderHistoryUI() {
    if (!historyGrid) return;
    historyGrid.innerHTML = '';

    for (let i = 0; i < MAX_HISTORY; i++) {
      const slot = document.createElement('div');
      slot.className = 'history-slot';

      if (historyEntries[i]) {
        slot.classList.add('has-content');
        const img = document.createElement('img');
        img.className = 'history-thumb';
        img.src = historyEntries[i].thumbnail;
        img.alt = `Historial ${i + 1}`;
        slot.appendChild(img);

        const targetIndex = i;
        slot.addEventListener('click', () => restoreHistory(targetIndex));
      }

      historyGrid.appendChild(slot);
    }
  }

  // --- UI DE COLORES ---
  function renderColorsList() {
    colorsList.innerHTML = '';

    colors.forEach((color, index) => {
      const card = document.createElement('div');
      card.className = 'input-card color-card';

      // Dot Preview + Color Picker nativo
      const dotWrapper = document.createElement('div');
      dotWrapper.className = 'color-dot-wrapper';

      const dot = document.createElement('span');
      dot.className = 'color-dot';
      dot.style.backgroundColor = color;

      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'native-color-picker';
      picker.value = color;

      picker.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase();
        colors[index] = val;
        dot.style.backgroundColor = val;
        hexInput.value = val;
        saveColors();
        triggerUpdate();
      });

      dotWrapper.appendChild(dot);
      dotWrapper.appendChild(picker);

      // Input de texto HEX
      const hexInput = document.createElement('input');
      hexInput.type = 'text';
      hexInput.className = 'color-hex-input';
      hexInput.value = color.toUpperCase();
      hexInput.maxLength = 7;
      hexInput.spellcheck = false;

      hexInput.addEventListener('input', (e) => {
        const norm = normalizeHex(e.target.value);
        if (norm) {
          colors[index] = norm;
          dot.style.backgroundColor = norm;
          picker.value = norm;
          saveColors();
          triggerUpdate();
        }
      });

      // Acciones: Random & Delete
      const actions = document.createElement('div');
      actions.className = 'card-actions';

      // Botón dado (random color individual)
      const btnRand = document.createElement('button');
      btnRand.className = 'icon-btn';
      btnRand.setAttribute('aria-label', 'Color aleatorio');
      btnRand.setAttribute('title', 'Color aleatorio');
      btnRand.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
          <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"></circle>
          <circle cx="12" cy="12" r="1.2" fill="currentColor"></circle>
          <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"></circle>
        </svg>
      `;
      btnRand.addEventListener('click', () => {
        const newCol = generateRandomHex();
        colors[index] = newCol;
        dot.style.backgroundColor = newCol;
        picker.value = newCol;
        hexInput.value = newCol;
        saveColors();
        triggerUpdate();
      });

      // Botón X (eliminar color)
      const btnDel = document.createElement('button');
      btnDel.className = 'icon-btn';
      btnDel.setAttribute('aria-label', 'Eliminar color');
      btnDel.setAttribute('title', 'Eliminar color');
      btnDel.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;

      if (colors.length <= MIN_COLORS) {
        btnDel.disabled = true;
        btnDel.style.opacity = '0.25';
      } else {
        btnDel.addEventListener('click', () => {
          colors.splice(index, 1);
          saveColors();
          renderColorsList();
          triggerUpdate();
        });
      }

      actions.appendChild(btnRand);
      actions.appendChild(btnDel);

      card.appendChild(dotWrapper);
      card.appendChild(hexInput);
      card.appendChild(actions);

      colorsList.appendChild(card);
    });

    // Controlar visibilidad de la fila para añadir
    if (colors.length >= MAX_COLORS) {
      addColorCard.style.display = 'none';
    } else {
      addColorCard.style.display = 'flex';
    }
  }

  // --- SLIDERS ---
  function updateSliderValues() {
    valComplexity.textContent = sliderComplexity.value;
    valBlur.textContent = sliderBlur.value;
    valNoise.textContent = sliderNoise.value;
  }

  function updateSliderTrack(slider) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    const percent = Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));

    slider.style.background = `linear-gradient(to right, #ffffff 0%, #ffffff ${percent}%, #1a1a1a ${percent}%, #1a1a1a 100%)`;
  }

  function updateSliderTracks() {
    updateSliderTrack(sliderComplexity);
    updateSliderTrack(sliderBlur);
    updateSliderTrack(sliderNoise);
  }

  // --- LISTENERS GENERALES ---

  // 1. Semilla
  inputSeed.addEventListener('input', () => {
    triggerUpdate();
  });

  btnRandomSeed.addEventListener('click', () => {
    inputSeed.value = generateRandomSeed();
    triggerUpdate();
  });

  // 2. Añadir Color
  newColorPicker.addEventListener('input', (e) => {
    const val = e.target.value.toUpperCase();
    newColorPreview.style.backgroundColor = val;
    inputNewColor.value = val;
  });

  inputNewColor.addEventListener('input', (e) => {
    const norm = normalizeHex(e.target.value);
    if (norm) {
      newColorPreview.style.backgroundColor = norm;
      newColorPicker.value = norm;
    }
  });

  btnRandomNewColor.addEventListener('click', () => {
    const randCol = generateRandomHex();
    newColorPreview.style.backgroundColor = randCol;
    newColorPicker.value = randCol;
    inputNewColor.value = randCol;
  });

  function handleAddColor() {
    if (colors.length >= MAX_COLORS) return;

    let candidate = normalizeHex(inputNewColor.value) || newColorPicker.value.toUpperCase();
    if (!candidate || !/^#[0-9a-fA-F]{6}$/.test(candidate)) {
      candidate = generateRandomHex();
    }

    colors.push(candidate);
    saveColors();

    // Resetear fila de añadir
    const nextCol = generateRandomHex();
    newColorPreview.style.backgroundColor = nextCol;
    newColorPicker.value = nextCol;
    inputNewColor.value = '';

    renderColorsList();
    triggerUpdate();
  }

  btnAddColor.addEventListener('click', handleAddColor);

  inputNewColor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAddColor();
    }
  });

  // 3. Sliders listeners
  [sliderComplexity, sliderBlur, sliderNoise].forEach((slider) => {
    slider.addEventListener('input', () => {
      updateSliderValues();
      updateSliderTrack(slider);
      triggerUpdate();
    });
  });

  // 4. Descargar PNG
  btnDownload.addEventListener('click', () => {
    const seed = inputSeed.value.trim() || 'mesh';
    const link = document.createElement('a');
    link.download = `mesh_${seed}.png`;
    link.href = meshCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // --- INICIALIZACIÓN ---
  function init() {
    updateSliderValues();
    updateSliderTracks();
    renderColorsList();
    renderHistoryUI();
    renderMesh();
    captureHistory();
  }

  init();
})();
