/* =========================================
   GPARSER // CORE LOGIC
   ========================================= */

// --- ESTADO GLOBAL ---
let processedMarkdown = "";
let originalFileName = "conversacion";

// --- ELEMENTOS DEL DOM ---
const elements = {
  btnUpload: document.getElementById('btnUpload'),
  fileInput: document.getElementById('fileInput'),
  btnDownload: document.getElementById('btnDownload'),
  dropZone: document.getElementById('dropZone'),
  emptyState: document.getElementById('emptyState'),
  previewContent: document.getElementById('previewContent')
};

// --- LISTENERS ---

// 1. Subida por botón
elements.btnUpload.addEventListener('click', () => {
  elements.fileInput.click();
});

elements.fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

// 2. Drag & Drop sobre la caja Bento
elements.dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  elements.dropZone.classList.add('dragover');
});

elements.dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  elements.dropZone.classList.remove('dragover');
});

elements.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  elements.dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFile(e.dataTransfer.files[0]);
  }
});

// Evitar comportamiento por defecto en el resto de la ventana
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// 3. Descarga directa a Markdown (.md)
elements.btnDownload.addEventListener('click', downloadMarkdown);

// --- FUNCIONES PRINCIPALES ---

function handleFile(file) {
  if (!file) return;
  originalFileName = file.name.replace(/\.[^/.]+$/, "") || "conversacion";

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const json = JSON.parse(content);
      processConversation(json);
    } catch (error) {
      alert("Error al leer el archivo JSON: " + error.message);
    }
  };
  reader.readAsText(file);
}

function extractTextFromChunk(chunk) {
  if (!chunk) return "";

  // Si tiene partes (Gemini / AI Studio format)
  if (chunk.parts && Array.isArray(chunk.parts)) {
    return chunk.parts
      .filter(p => !p.thought) // Descartar cualquier pensamiento dentro de las partes
      .map(p => p.text || "")
      .join("")
      .trim();
  }

  // Si tiene texto directo
  if (typeof chunk.text === 'string') {
    return chunk.text.trim();
  }

  // Si tiene content (OpenAI format)
  if (typeof chunk.content === 'string') {
    return chunk.content.trim();
  } else if (Array.isArray(chunk.content)) {
    return chunk.content
      .map(c => (typeof c === 'string' ? c : (c.text || "")))
      .join("")
      .trim();
  }

  return "";
}

function processConversation(json) {
  let chunks = [];

  // 1. Detectar estructura de chunks / mensajes
  if (json.chunkedPrompt && Array.isArray(json.chunkedPrompt.chunks)) {
    chunks = json.chunkedPrompt.chunks;
  } else if (Array.isArray(json.chunks)) {
    chunks = json.chunks;
  } else if (Array.isArray(json.messages)) {
    chunks = json.messages;
  } else if (Array.isArray(json)) {
    chunks = json;
  } else if (json.contents && Array.isArray(json.contents)) {
    chunks = json.contents;
  } else {
    throw new Error("No se encontró una lista de mensajes/chunks en el JSON.");
  }

  const markdownBlocks = [];

  for (const chunk of chunks) {
    // Descartar pensamientos completos (Chain of Thought / CoT)
    if (chunk.isThought || chunk.thought) {
      continue;
    }

    // Identificar rol: siempre 'Usuario' o 'Modelo'
    const roleRaw = (chunk.role || "").toLowerCase();
    let roleLabel = "";

    if (roleRaw === 'user' || roleRaw === 'usuario' || roleRaw === 'human') {
      roleLabel = "Usuario";
    } else if (roleRaw === 'model' || roleRaw === 'modelo' || roleRaw === 'assistant' || roleRaw === 'ai') {
      roleLabel = "Modelo";
    } else {
      // Ignorar otros roles como system o herramientas
      continue;
    }

    const text = extractTextFromChunk(chunk);
    if (!text) continue;

    markdownBlocks.push(`### ${roleLabel}\n\n${text}`);
  }

  if (markdownBlocks.length === 0) {
    alert("No se encontraron mensajes válidos de Usuario o Modelo en el archivo.");
    return;
  }

  processedMarkdown = markdownBlocks.join("\n\n---\n\n");

  // Mostrar preview en la caja negra y habilitar botón de descarga
  elements.emptyState.style.display = 'none';
  elements.previewContent.style.display = 'block';
  elements.previewContent.textContent = processedMarkdown;
  elements.btnDownload.removeAttribute('disabled');
}

function downloadMarkdown() {
  if (!processedMarkdown) return;

  const blob = new Blob([processedMarkdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${originalFileName}_clean.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
