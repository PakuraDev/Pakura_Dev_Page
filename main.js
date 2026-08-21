// Configuración exacta ajustada
const CONFIG = {
  zoom: 0.50,       // Zoom al 50%
  speed: 0.2,       // Velocidad general
  driftRatio: 0.9,  // Velocidad relativa patrón 2
  innerScale: 0.55  // Núcleo concéntrico al 55%
};

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl', { powerPreference: 'low-power', antialias: false }) 
        || canvas.getContext('experimental-webgl');

if (!gl) {
  alert('WebGL no está disponible en este navegador.');
}

// Límite máximo de textura soportado por la GPU del dispositivo (vital para móviles)
const MAX_GPU_TEXTURE_SIZE = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096, 4096);

// Shaders GLSL
const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SRC = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 v_uv;

  uniform sampler2D u_texture1;
  uniform sampler2D u_texture2;
  uniform vec2 u_resolution;
  uniform vec2 u_imgSize1;
  uniform vec2 u_imgSize2;
  uniform vec2 u_off1;
  uniform vec2 u_off2;
  uniform float u_zoom;

  // Paleta de colores RGB
  const vec3 COLOR_BASE     = vec3(0.2157, 0.7137, 0.7725); // #37B6C5
  const vec3 COLOR_AZUL1    = vec3(0.2980, 0.7765, 0.8196); // #4CC6D1
  const vec3 COLOR_AZUL2    = vec3(0.4275, 0.8471, 0.8863); // #6DD8E2
  const vec3 COLOR_AZUL3    = vec3(0.4863, 0.8745, 0.8980); // #7CDFE5
  const vec3 COLOR_BLANCO_I = vec3(0.6275, 0.9137, 0.9373); // #A0E9EF
  const vec3 COLOR_BLANCO_S = vec3(0.7961, 0.9686, 0.9804); // #CBF7FA

  // Función de espejado continuo (Mirrored Repeat) segura para coordenadas negativas
  vec2 mirrorCoord(vec2 uv) {
    vec2 m = mod(mod(uv, 2.0) + 2.0, 2.0);
    vec2 mirrored = mix(m, 2.0 - m, step(1.0, m));
    return clamp(mirrored, 0.0, 0.99999);
  }

  void main() {
    // Coordenadas en píxeles de pantalla
    vec2 fragCoord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 srcPix = fragCoord / u_zoom;

    // Muestreo en espacio UV espejado de cada patrón
    vec2 uv1 = mirrorCoord((srcPix + u_off1) / u_imgSize1);
    vec2 uv2 = mirrorCoord((srcPix + u_off2) / u_imgSize2);

    float t1 = texture2D(u_texture1, uv1).r;
    float t2 = texture2D(u_texture2, uv2).r;

    vec3 finalColor;

    /* Jerarquía de capas (escalado en [0.0, 1.0]):
       t1: > 0.85 = Blanco Superior (Núcleo)
           > 0.50 = Blanco Inferior (Borde)
           > 0.15 = Línea Patrón 1 (Gris)
           <= 0.15 = Fondo
       t2: > 0.50 = Línea Patrón 2 (Olas de agua)
           <= 0.50 = Fondo
    */
    if (t1 > 0.85) {
      finalColor = COLOR_BLANCO_S;
    } else if (t1 > 0.50) {
      finalColor = COLOR_BLANCO_I;
    } else if (t1 > 0.15) {
      finalColor = (t2 > 0.5) ? COLOR_AZUL3 : COLOR_AZUL2;
    } else {
      finalColor = (t2 > 0.5) ? COLOR_AZUL1 : COLOR_BASE;
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Error compilando shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  console.error('Error enlazando WebGL program:', gl.getProgramInfoLog(program));
}

gl.useProgram(program);

// Quad que cubre toda la pantalla (-1 a 1)
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1,
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

// Localizaciones de uniforms
const uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');
const uImgSize1Loc   = gl.getUniformLocation(program, 'u_imgSize1');
const uImgSize2Loc   = gl.getUniformLocation(program, 'u_imgSize2');
const uOff1Loc       = gl.getUniformLocation(program, 'u_off1');
const uOff2Loc       = gl.getUniformLocation(program, 'u_off2');
const uZoomLoc       = gl.getUniformLocation(program, 'u_zoom');
const uTex1Loc       = gl.getUniformLocation(program, 'u_texture1');
const uTex2Loc       = gl.getUniformLocation(program, 'u_texture2');

gl.uniform1i(uTex1Loc, 0);
gl.uniform1i(uTex2Loc, 1);
gl.uniform1f(uZoomLoc, CONFIG.zoom);

let w1 = 0, h1 = 0;
let w2 = 0, h2 = 0;
let texture1 = null;
let texture2 = null;
let img1Ready = false;
let img2Ready = false;

// Detección de dispositivo: PC-HD vs Mobile-HD
function getOptimalAssetVariant() {
  const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMobile ? 'Mobile-HD' : 'PC-HD';
}

const currentVariant = getOptimalAssetVariant();
console.log(`[AssetLoader] Variante seleccionada: ${currentVariant}`);

const img1 = new Image();
const img2 = new Image();

function loadImage(imgElement, path, fallbackPath, onLoaded) {
  imgElement.onload = () => onLoaded(imgElement);
  imgElement.onerror = () => {
    if (fallbackPath && imgElement.src !== fallbackPath) {
      console.warn(`No se pudo cargar ${path}, usando fallback ${fallbackPath}...`);
      imgElement.src = fallbackPath;
    } else {
      console.error(`Error crítico cargando imagen ${path}`);
    }
  };
  imgElement.src = path;
}

const p1Path = `assets/water/Patron_1-${currentVariant}.webp`;
const p2Path = `assets/water/Patron_2-${currentVariant}.webp`;
const p1Fallback = 'assets/water/Patron_1-PC-HD.webp';
const p2Fallback = 'assets/water/Patron_2-PC-HD.webp';

loadImage(img1, p1Path, p1Fallback, (loadedImg) => {
  const origW = loadedImg.naturalWidth;
  const origH = loadedImg.naturalHeight;
  const scale = Math.min(1.0, MAX_GPU_TEXTURE_SIZE / Math.max(origW, origH));
  w1 = Math.round(origW * scale);
  h1 = Math.round(origH * scale);

  const processedData = preprocessPatron1(loadedImg, w1, h1);
  texture1 = uploadTexture(processedData, w1, h1, 0);
  img1Ready = true;
  checkReady();
});

loadImage(img2, p2Path, p2Fallback, (loadedImg) => {
  const origW = loadedImg.naturalWidth;
  const origH = loadedImg.naturalHeight;
  const scale = Math.min(1.0, MAX_GPU_TEXTURE_SIZE / Math.max(origW, origH));
  w2 = Math.round(origW * scale);
  h2 = Math.round(origH * scale);

  const processedData = preprocessPatron2(loadedImg, w2, h2);
  texture2 = uploadTexture(processedData, w2, h2, 1);
  img2Ready = true;
  checkReady();
});

function uploadTexture(data, width, height, unit) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0,
    gl.LUMINANCE, gl.UNSIGNED_BYTE, data
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  return tex;
}

// Preprocesado morfológico en Patrón 1 (Distance Field para núcleos concéntricos)
function preprocessPatron1(image, w, h) {
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const oCtx = offscreen.getContext('2d', { willReadFrequently: true });
  oCtx.drawImage(image, 0, 0, w, h);
  const rawData = oCtx.getImageData(0, 0, w, h).data;

  const total = w * h;
  const distField = new Float32Array(total);
  const blobIdMap = new Int32Array(total);
  blobIdMap.fill(-1);

  const isWhite = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const a = rawData[p + 3];
    if (a < 50) continue; // Transparente es fondo
    const brightness = 0.299 * rawData[p] + 0.587 * rawData[p + 1] + 0.114 * rawData[p + 2];
    if (brightness >= 220) isWhite[i] = 1;
  }

  // Chamfer Distance Transform 2-pass
  const INF = 999999;
  for (let i = 0; i < total; i++) distField[i] = isWhite[i] ? INF : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (distField[idx] === 0) continue;
      let d = distField[idx];
      if (x > 0) d = Math.min(d, distField[idx - 1] + 1);
      if (y > 0) d = Math.min(d, distField[idx - w] + 1);
      if (x > 0 && y > 0) d = Math.min(d, distField[idx - w - 1] + 1.414);
      if (x < w - 1 && y > 0) d = Math.min(d, distField[idx - w + 1] + 1.414);
      distField[idx] = d;
    }
  }

  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const idx = y * w + x;
      if (distField[idx] === 0) continue;
      let d = distField[idx];
      if (x < w - 1) d = Math.min(d, distField[idx + 1] + 1);
      if (y < h - 1) d = Math.min(d, distField[idx + w] + 1);
      if (x < w - 1 && y < h - 1) d = Math.min(d, distField[idx + w + 1] + 1.414);
      if (x > 0 && y < h - 1) d = Math.min(d, distField[idx + w - 1] + 1.414);
      distField[idx] = d;
    }
  }

  // Identificación de manchas blancas conectadas
  let currentBlob = 0;
  const maxDistList = [];
  const queue = new Int32Array(total);

  for (let i = 0; i < total; i++) {
    if (isWhite[i] && blobIdMap[i] === -1) {
      let head = 0, tail = 0;
      queue[tail++] = i;
      blobIdMap[i] = currentBlob;
      let maxD = distField[i];

      while (head < tail) {
        const curr = queue[head++];
        const cx = curr % w;
        const cy = Math.floor(curr / w);
        if (distField[curr] > maxD) maxD = distField[curr];

        const neighbors = [
          cx > 0 ? curr - 1 : -1,
          cx < w - 1 ? curr + 1 : -1,
          cy > 0 ? curr - w : -1,
          cy < h - 1 ? curr + w : -1
        ];

        for (let n = 0; n < 4; n++) {
          const nIdx = neighbors[n];
          if (nIdx !== -1 && isWhite[nIdx] && blobIdMap[nIdx] === -1) {
            blobIdMap[nIdx] = currentBlob;
            queue[tail++] = nIdx;
          }
        }
      }
      maxDistList.push(maxD);
      currentBlob++;
    }
  }

  const maxDistPerBlob = new Float32Array(maxDistList);
  const outTypes = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const a = rawData[p + 3];
    if (a < 50) {
      outTypes[i] = 0; // Transparente = Fondo
      continue;
    }

    const brightness = 0.299 * rawData[p] + 0.587 * rawData[p + 1] + 0.114 * rawData[p + 2];

    if (brightness < 80) {
      outTypes[i] = 0;   // Fondo
    } else if (brightness < 220) {
      outTypes[i] = 85;  // Línea gris (~0.33)
    } else {
      const blobId = blobIdMap[i];
      const dist = distField[i];
      const maxD = maxDistPerBlob[blobId] || 1;
      const threshold = Math.max(1.8, maxD * (1 - CONFIG.innerScale));

      if (dist >= threshold && maxD > 1.5) {
        outTypes[i] = 255; // Blanco Superior (Núcleo 1.0)
      } else {
        outTypes[i] = 170; // Blanco Inferior (Borde ~0.66)
      }
    }
  }

  return outTypes;
}

// Preprocesado de Patrón 2 (Robusto para RGB, Alpha y Grayscale)
function preprocessPatron2(image, w, h) {
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const oCtx = offscreen.getContext('2d', { willReadFrequently: true });
  oCtx.drawImage(image, 0, 0, w, h);
  const data = oCtx.getImageData(0, 0, w, h).data;

  const total = w * h;
  const out = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const a = data[p + 3];
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    if (a < 50) {
      out[i] = 0;   // Fondo transparente
    } else if (brightness > 50) {
      out[i] = 255; // Línea blanca / clara (1.0)
    } else {
      out[i] = 0;   // Fondo negro
    }
  }

  return out;
}

// Ajuste dinámico de resolución de pantalla
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap a 2x DPR para máxima eficiencia en móvil
  const width = Math.round(window.innerWidth * dpr);
  const height = Math.round(window.innerHeight * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}

window.addEventListener('resize', resize);
resize();

function checkReady() {
  if (img1Ready && img2Ready) {
    requestAnimationFrame(renderLoop);
  }
}

// Bucle de animación continua en GPU
let animTime = 0;
let floatClock = 0;
let lastTime = performance.now();

function renderLoop(currentTime) {
  const dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  animTime += dt * CONFIG.speed;
  floatClock += dt;

  // Ondulación fluida continua del agua
  const ampX = w1 * 0.07;
  const ampY = h1 * 0.07;

  const off1X = Math.sin(animTime * 0.28) * ampX + Math.cos(animTime * 0.13) * (ampX * 0.5);
  const off1Y = Math.cos(animTime * 0.22) * ampY + Math.sin(animTime * 0.17) * (ampY * 0.5);

  const t2 = animTime * CONFIG.driftRatio;
  const off2X = Math.sin(t2 * 0.25 + 1.6) * (ampX * 0.9) + Math.cos(t2 * 0.18 + 0.8) * (ampX * 0.6) + (w1 * 0.08);
  const off2Y = Math.cos(t2 * 0.21 + 2.1) * (ampY * 0.9) + Math.sin(t2 * 0.14 + 1.2) * (ampY * 0.5) + (h1 * 0.08);

  gl.useProgram(program);
  gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);
  gl.uniform2f(uImgSize1Loc, w1, h1);
  gl.uniform2f(uImgSize2Loc, w2, h2);
  gl.uniform2f(uOff1Loc, off1X, off1Y);
  gl.uniform2f(uOff2Loc, off2X, off2Y);
  gl.uniform1f(uZoomLoc, CONFIG.zoom);

  // Asegurar enlace de texturas en cada fotograma
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture1);
  gl.uniform1i(uTex1Loc, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texture2);
  gl.uniform1i(uTex2Loc, 1);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Animación de flotación orgánica, visible y armónica de los nenúfares
  for (let i = 0; i < activeLilyPads.length; i++) {
    const pad = activeLilyPads[i];
    const dx = Math.sin(floatClock * pad.freqX + pad.phaseX) * pad.ampX 
             + Math.cos(floatClock * (pad.freqX * 0.5) + pad.phaseY) * (pad.ampX * 0.4);
    const dy = Math.cos(floatClock * pad.freqY + pad.phaseY) * pad.ampY 
             + Math.sin(floatClock * (pad.freqY * 0.6) + pad.phaseX) * (pad.ampY * 0.4);
    const sway = Math.sin(floatClock * (pad.freqX * 0.7) + pad.phaseX) * pad.swayAmp;

    pad.el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${(pad.baseRot + sway).toFixed(2)}deg) scale(${pad.flipX}, 1)`;
  }

  requestAnimationFrame(renderLoop);
}

// Lista global de nenúfares activos para animación
const activeLilyPads = [];

// Genera un ángulo aleatorio evitando ángulos rectos exactos (0, 90, 180, 270)
function getRandomNonRightAngle() {
  const quadrants = [
    { min: 0.1, max: 89.9 },
    { min: 90.1, max: 179.9 },
    { min: 180.1, max: 269.9 },
    { min: 270.1, max: 359.9 }
  ];
  const q = quadrants[Math.floor(Math.random() * quadrants.length)];
  return (q.min + Math.random() * (q.max - q.min)).toFixed(1);
}

// Inicialización de nenúfares con distribución por lados y máxima separación global
function initLilyPads() {
  const container = document.getElementById('lilyPadsContainer') || document.body;
  container.innerHTML = '';
  activeLilyPads.length = 0;
  
  const availableImages = [
    'assets/water/esquina_1.webp',
    'assets/water/esquina_2.webp',
    'assets/water/esquina_3.webp'
  ];

  // 4 lados posibles: 'top', 'bottom', 'left', 'right'
  const availableSides = ['top', 'bottom', 'left', 'right'];

  // Siempre 3 nenúfares, exactamente 1 por lado distinto
  const count = 3;

  // Barajar imágenes y lados sin repetición
  const shuffledImages = [...availableImages].sort(() => Math.random() - 0.5);
  const shuffledSides = [...availableSides].sort(() => Math.random() - 0.5);

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const sideMargin = 50;

  // Precalcular especificaciones de tamaño y orientación para cada nenúfar
  const padSpecs = [];
  for (let i = 0; i < count; i++) {
    const sizeVw = (Math.random() * (24 - 15) + 15).toFixed(1); // 15vw - 24vw
    const minPx = Math.round(115 + Math.random() * 25);         // 115px - 140px
    const maxPx = Math.round(230 + Math.random() * 50);         // 230px - 280px
    const estimatedWidth = Math.min(Math.max(minPx, screenW * (parseFloat(sizeVw) / 100)), maxPx);
    const estimatedHeight = estimatedWidth * 0.85;
    const rot = getRandomNonRightAngle();
    const flipX = Math.random() < 0.5 ? 1 : -1;

    padSpecs.push({
      imgSrc: shuffledImages[i],
      side: shuffledSides[i],
      sizeVw,
      minPx,
      maxPx,
      estimatedWidth,
      estimatedHeight,
      rot,
      flipX
    });
  }

  // Optimización global Max-Min Distance: probar múltiples disposiciones completas y elegir la de mayor dispersión
  let bestConfig = null;
  let bestMinDist = -1;

  for (let attempt = 0; attempt < 200; attempt++) {
    const candidatePositions = [];

    for (let i = 0; i < count; i++) {
      const spec = padSpecs[i];
      const side = spec.side;
      const depth = Math.round(40 + Math.random() * 70); // 40px a 110px
      let posX = 0;
      let posY = 0;
      let cx = 0;
      let cy = 0;

      if (side === 'top' || side === 'bottom') {
        const minX = sideMargin;
        const maxX = Math.max(minX, screenW - sideMargin - spec.estimatedWidth);
        posX = Math.round(minX + Math.random() * (maxX - minX));
        cx = posX + spec.estimatedWidth / 2;
        cy = side === 'top' ? (depth + spec.estimatedHeight / 2) : (screenH - depth - spec.estimatedHeight / 2);
      } else {
        const minY = sideMargin;
        const maxY = Math.max(minY, screenH - sideMargin - spec.estimatedHeight);
        posY = Math.round(minY + Math.random() * (maxY - minY));
        cx = side === 'left' ? (depth + spec.estimatedWidth / 2) : (screenW - depth - spec.estimatedWidth / 2);
        cy = posY + spec.estimatedHeight / 2;
      }

      candidatePositions.push({ depth, posX, posY, cx, cy });
    }

    // Calcular la separación mínima entre cualquier par de nenúfares
    const d01 = Math.hypot(candidatePositions[0].cx - candidatePositions[1].cx, candidatePositions[0].cy - candidatePositions[1].cy);
    const d12 = Math.hypot(candidatePositions[1].cx - candidatePositions[2].cx, candidatePositions[1].cy - candidatePositions[2].cy);
    const d20 = Math.hypot(candidatePositions[2].cx - candidatePositions[0].cx, candidatePositions[2].cy - candidatePositions[0].cy);
    const minPairDist = Math.min(d01, d12, d20);

    if (minPairDist > bestMinDist) {
      bestMinDist = minPairDist;
      bestConfig = candidatePositions;
    }
  }

  // Renderizar los 3 nenúfares con la mejor configuración encontrada
  for (let i = 0; i < count; i++) {
    const spec = padSpecs[i];
    const pos = bestConfig[i];
    const side = spec.side;

    const img = document.createElement('img');
    img.src = spec.imgSrc;
    img.alt = 'Nenúfares decorativos';
    img.className = 'lily-pad';
    img.style.width = `clamp(${spec.minPx}px, ${spec.sizeVw}vw, ${spec.maxPx}px)`;

    if (side === 'top' || side === 'bottom') {
      if (side === 'top') {
        img.style.top = `${pos.depth}px`;
      } else {
        img.style.bottom = `${pos.depth}px`;
      }
      img.style.left = `${pos.posX}px`;
    } else {
      if (side === 'left') {
        img.style.left = `${pos.depth}px`;
      } else {
        img.style.right = `${pos.depth}px`;
      }
      img.style.top = `${pos.posY}px`;
    }

    img.style.transform = `rotate(${spec.rot}deg) scale(${spec.flipX}, 1)`;

    // Registrar datos de física de flotación activa (movimiento sutil y relajante)
    activeLilyPads.push({
      el: img,
      baseRot: parseFloat(spec.rot),
      flipX: spec.flipX,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      freqX: 0.70 + Math.random() * 0.30, // Ciclo pausado de 6 a 9 segundos
      freqY: 0.60 + Math.random() * 0.25,
      ampX: 5.0 + Math.random() * 2.5,   // Deriva sutil de 5px a 7.5px
      ampY: 4.5 + Math.random() * 2.0,   // Deriva sutil de 4.5px a 6.5px
      swayAmp: 1.8 + Math.random() * 0.8 // Cabeceo suave de ±1.8° a ±2.6°
    });

    container.appendChild(img);
  }
}

// Ejecutar colocación de nenúfares
initLilyPads();

// ==========================================
// Control de Audio Ambiental y Pantalla Inicial (Modo Mar)
// ==========================================
function initBackgroundAudio() {
  const bgAudio = document.getElementById('bgAudio');
  const btnVerMar = document.getElementById('btnVerMar');
  const pageContainer = document.getElementById('pageContainer');

  if (!bgAudio || !pageContainer) return;

  const TARGET_VOLUME = 0.70;
  bgAudio.volume = 0;
  let isSeaModeActive = false;
  let fadeInterval = null;

  function clearFade() {
    if (fadeInterval) {
      clearInterval(fadeInterval);
      fadeInterval = null;
    }
  }

  function fadeInAudio(target = TARGET_VOLUME, duration = 800) {
    clearFade();
    const stepTime = 50;
    const steps = Math.max(1, duration / stepTime);
    const stepVolume = (target - bgAudio.volume) / steps;

    fadeInterval = setInterval(() => {
      if (!isSeaModeActive) {
        clearFade();
        stopAudioImmediate();
        return;
      }
      const nextVol = bgAudio.volume + stepVolume;
      if (nextVol >= target) {
        bgAudio.volume = target;
        clearFade();
      } else {
        bgAudio.volume = Math.min(target, Math.max(0, nextVol));
      }
    }, stepTime);
  }

  function fadeOutAudio(duration = 400) {
    clearFade();
    const currentVol = bgAudio.volume;
    if (currentVol <= 0.01) {
      stopAudioImmediate();
      return;
    }

    const stepTime = 50;
    const steps = Math.max(1, duration / stepTime);
    const stepVolume = currentVol / steps;

    fadeInterval = setInterval(() => {
      const nextVol = bgAudio.volume - stepVolume;
      if (nextVol <= 0.02) {
        stopAudioImmediate();
      } else {
        bgAudio.volume = Math.max(0, Math.min(1, nextVol));
      }
    }, stepTime);
  }

  function stopAudioImmediate() {
    clearFade();
    try {
      bgAudio.volume = 0;
      bgAudio.pause();
    } catch (err) {
      // Ignorar errores de pausa si ya está pausado
    }
  }

  function startAudio() {
    isSeaModeActive = true;
    if (bgAudio.paused) {
      const playPromise = bgAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (!isSeaModeActive) {
              stopAudioImmediate();
            } else {
              fadeInAudio();
            }
          })
          .catch(() => {
            // El navegador bloqueó autoplay o falló
          });
      }
    } else {
      fadeInAudio();
    }
  }

  function stopAudio() {
    isSeaModeActive = false;
    fadeOutAudio();
  }

  function enterSeaMode() {
    isSeaModeActive = true;
    pageContainer.classList.add('sea-mode');
    // Restaurar cualquier tarjeta oculta previamente
    document.querySelectorAll('.bento-card').forEach(card => {
      card.classList.remove('card-hidden');
    });
    startAudio();
  }

  function exitSeaMode() {
    isSeaModeActive = false;
    pageContainer.classList.remove('sea-mode');
    // Restaurar visibilidad de todas las tarjetas para el modo normal
    document.querySelectorAll('.bento-card').forEach(card => {
      card.classList.remove('card-hidden');
    });
    stopAudio();
  }

  if (btnVerMar) {
    // Al pulsar el botón de ver el mar se conmuta el Modo Mar
    btnVerMar.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pageContainer.classList.contains('sea-mode')) {
        exitSeaMode();
      } else {
        enterSeaMode();
      }
    });
  }

  // En Modo Mar: al pulsar una card, esa card desaparece
  const bentoGrid = document.querySelector('.bento-grid');
  if (bentoGrid) {
    bentoGrid.addEventListener('click', (e) => {
      if (pageContainer.classList.contains('sea-mode')) {
        const card = e.target.closest('.bento-card');
        if (card && !card.classList.contains('card-hidden')) {
          e.stopPropagation();
          e.preventDefault();
          card.classList.add('card-hidden');
        }
      }
    });
  }

  // Al hacer clic en cualquier otro lado fuera de las tarjetas activas, vuelve al modo normal
  window.addEventListener('click', (e) => {
    if (pageContainer.classList.contains('sea-mode')) {
      if (!e.target.closest('.header-btn')) {
        exitSeaMode();
      }
    }
  });
}

// Inicializar audio y eventos de navegación
initBackgroundAudio();









