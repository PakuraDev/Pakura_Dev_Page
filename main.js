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
  precision highp float;
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

  // Función de espejado continuo (Mirrored Repeat)
  vec2 mirrorCoord(vec2 uv) {
    vec2 m = mod(uv, 2.0);
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

    float t1 = floor(texture2D(u_texture1, uv1).r * 255.0 + 0.5);
    float t2 = floor(texture2D(u_texture2, uv2).r * 255.0 + 0.5);

    vec3 finalColor;

    /* Jerarquía de capas:
       t1: 3 = Blanco Superior (Núcleo)
           2 = Blanco Inferior (Borde)
           1 = Línea Patrón 1 (Gris)
           0 = Fondo
       t2: 1 = Línea Patrón 2 (Blanco)
           0 = Fondo
    */
    if (t1 == 3.0) {
      finalColor = COLOR_BLANCO_S;
    } else if (t1 == 2.0) {
      finalColor = COLOR_BLANCO_I;
    } else if (t1 == 1.0) {
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

// Cargar y preprocesar Patrón 1
const img1 = new Image();
const img2 = new Image();
img1.src = 'Patron_1.png';
img2.src = 'Patron_2.png';

img1.onload = () => {
  w1 = img1.naturalWidth;
  h1 = img1.naturalHeight;
  const processedData = preprocessPatron1(img1, w1, h1);
  texture1 = uploadTexture(processedData, w1, h1, 0);
  img1Ready = true;
  checkReady();
};

img2.onload = () => {
  w2 = img2.naturalWidth;
  h2 = img2.naturalHeight;
  const processedData = preprocessPatron2(img2, w2, h2);
  texture2 = uploadTexture(processedData, w2, h2, 1);
  img2Ready = true;
  checkReady();
};

function uploadTexture(data, width, height, unit) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);

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
  const oCtx = offscreen.getContext('2d');
  oCtx.drawImage(image, 0, 0);
  const rawData = oCtx.getImageData(0, 0, w, h).data;

  const total = w * h;
  const distField = new Float32Array(total);
  const blobIdMap = new Int32Array(total);
  blobIdMap.fill(-1);

  const isWhite = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * 4;
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
    const brightness = 0.299 * rawData[p] + 0.587 * rawData[p + 1] + 0.114 * rawData[p + 2];

    if (brightness < 80) {
      outTypes[i] = 0; // Fondo
    } else if (brightness < 220) {
      outTypes[i] = 1; // Línea gris
    } else {
      const blobId = blobIdMap[i];
      const dist = distField[i];
      const maxD = maxDistPerBlob[blobId] || 1;
      const threshold = Math.max(1.8, maxD * (1 - CONFIG.innerScale));

      if (dist >= threshold && maxD > 1.5) {
        outTypes[i] = 3; // Blanco Superior (Núcleo)
      } else {
        outTypes[i] = 2; // Blanco Inferior (Borde)
      }
    }
  }

  return outTypes;
}

// Preprocesado de Patrón 2
function preprocessPatron2(image, w, h) {
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const oCtx = offscreen.getContext('2d');
  oCtx.drawImage(image, 0, 0);
  const data = oCtx.getImageData(0, 0, w, h).data;

  const total = w * h;
  const out = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const brightness = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    out[i] = brightness > 60 ? 1 : 0;
  }

  return out;
}

// Ajuste dinámico de resolución
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
    gl.uniform2f(uImgSize1Loc, w1, h1);
    gl.uniform2f(uImgSize2Loc, w2, h2);
    requestAnimationFrame(renderLoop);
  }
}

// Bucle de animación en GPU
let animTime = 0;
let lastTime = performance.now();
let dragX = 0;
let dragY = 0;

function renderLoop(currentTime) {
  const dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  animTime += dt * CONFIG.speed;

  // Ondulación fluida proporcional a las dimensiones reales de la imagen
  const ampX = w1 * 0.07;
  const ampY = h1 * 0.07;

  const off1X = dragX + Math.sin(animTime * 0.28) * ampX + Math.cos(animTime * 0.13) * (ampX * 0.5);
  const off1Y = dragY + Math.cos(animTime * 0.22) * ampY + Math.sin(animTime * 0.17) * (ampY * 0.5);

  const t2 = animTime * CONFIG.driftRatio;
  const off2X = dragX + Math.sin(t2 * 0.25 + 1.6) * (ampX * 0.9) + Math.cos(t2 * 0.18 + 0.8) * (ampX * 0.6) + (w1 * 0.08);
  const off2Y = dragY + Math.cos(t2 * 0.21 + 2.1) * (ampY * 0.9) + Math.sin(t2 * 0.14 + 1.2) * (ampY * 0.5) + (h1 * 0.08);

  gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);
  gl.uniform2f(uOff1Loc, off1X, off1Y);
  gl.uniform2f(uOff2Loc, off2X, off2Y);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  requestAnimationFrame(renderLoop);
}

// Control de la pantalla inicial
let introScreenOpen = true;
const exploreBtn = document.getElementById('exploreBtn');
const introScreen = document.getElementById('introScreen');

if (exploreBtn && introScreen) {
  exploreBtn.addEventListener('click', () => {
    introScreenOpen = false;
    introScreen.classList.add('slide-up');
    introScreen.addEventListener('transitionend', () => {
      introScreen.style.display = 'none';
    }, { once: true });
  });
}

// Soporte de interacción táctil y ratón
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

window.addEventListener('mousedown', (e) => {
  if (introScreenOpen) return;
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mouseup', () => { isDragging = false; });

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  dragX -= dx * (1 / CONFIG.zoom);
  dragY -= dy * (1 / CONFIG.zoom);
});

window.addEventListener('touchstart', (e) => {
  if (introScreenOpen) return;
  if (e.touches.length === 1) {
    isDragging = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
  }
}, { passive: true });

window.addEventListener('touchend', () => { isDragging = false; });

window.addEventListener('touchmove', (e) => {
  if (!isDragging || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - lastMouseX;
  const dy = e.touches[0].clientY - lastMouseY;
  lastMouseX = e.touches[0].clientX;
  lastMouseY = e.touches[0].clientY;

  dragX -= dx * (1 / CONFIG.zoom);
  dragY -= dy * (1 / CONFIG.zoom);
}, { passive: true });
