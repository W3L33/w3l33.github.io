const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl", { antialias: true });

gl.clearColor(0, 0, 0, 1);

function resize() {
  const vw = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
  const vh = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = vw * dpr;
  canvas.height = vh * dpr;
  canvas.style.width = vw + "px";
  canvas.style.height = vh + "px";
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
  window.visualViewport.addEventListener("scroll", resize);
}
resize();

document.addEventListener("gesturestart", e => {
  e.preventDefault();
});
document.addEventListener("gesturechange", e => {
  e.preventDefault();
});
document.addEventListener("gestureend", e => {
  e.preventDefault();
});
document.addEventListener(
  "touchmove",
  e => {
    e.preventDefault();
  },
  { passive: false }
);
document.addEventListener(
  "wheel",
  e => {
    e.preventDefault();
  },
  { passive: false }
);

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader.textContent));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader.textContent));
gl.linkProgram(program);
gl.useProgram(program);

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

/* Fullscreen quad */
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1,-1,  1,-1, -1, 1,
  -1, 1,  1,-1,  1, 1
]), gl.STATIC_DRAW);

const pos = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(pos);
gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

/* Uniforms */
const u_resolution = gl.getUniformLocation(program, "u_resolution");
const u_viewport   = gl.getUniformLocation(program, "u_viewport");
const u_mouse      = gl.getUniformLocation(program, "u_mouse");
const u_size       = gl.getUniformLocation(program, "u_size");
const u_imageRes   = gl.getUniformLocation(program, "u_imageResolution");

gl.uniform1f(gl.getUniformLocation(program, "u_dpr"), devicePixelRatio || 1);
gl.uniform1i(gl.getUniformLocation(program, "u_background"), 0);

/* Background image */
const bg = gl.createTexture();
const img = new Image();
img.crossOrigin = "anonymous";

const modalGlassCanvas = document.getElementById("modal-glass-canvas");
const modalContent = document.querySelector(".glass-modal-content");
let modalGl = null;
let modalProgram = null;
let modalBuffer = null;
let modalBgTex = null;
let modalPos = -1;
let modalU_resolution;
let modalU_viewport;
let modalU_rect;
let modalU_imageRes;
let modalU_sampler;

function compileModalShader(type, src) {
  const s = modalGl.createShader(type);
  modalGl.shaderSource(s, src);
  modalGl.compileShader(s);
  return s;
}

function initModalGlassWebGL() {
  const modalFrag = document.getElementById("modalGlassFragmentShader");
  if (!modalGlassCanvas || !modalContent || !modalFrag || !modalFrag.textContent.trim()) {
    return;
  }
  modalGl = modalGlassCanvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: true
  });
  if (!modalGl) return;

  modalProgram = modalGl.createProgram();
  modalGl.attachShader(
    modalProgram,
    compileModalShader(modalGl.VERTEX_SHADER, vertexShader.textContent)
  );
  modalGl.attachShader(
    modalProgram,
    compileModalShader(modalGl.FRAGMENT_SHADER, modalFrag.textContent)
  );
  modalGl.linkProgram(modalProgram);
  if (!modalGl.getProgramParameter(modalProgram, modalGl.LINK_STATUS)) {
    console.error(modalGl.getProgramInfoLog(modalProgram));
    modalProgram = null;
    return;
  }

  modalBuffer = modalGl.createBuffer();
  modalGl.bindBuffer(modalGl.ARRAY_BUFFER, modalBuffer);
  modalGl.bufferData(
    modalGl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    modalGl.STATIC_DRAW
  );

  modalPos = modalGl.getAttribLocation(modalProgram, "a_position");
  modalU_resolution = modalGl.getUniformLocation(modalProgram, "u_resolution");
  modalU_viewport = modalGl.getUniformLocation(modalProgram, "u_viewport");
  modalU_rect = modalGl.getUniformLocation(modalProgram, "u_rect");
  modalU_imageRes = modalGl.getUniformLocation(modalProgram, "u_imageResolution");
  modalU_sampler = modalGl.getUniformLocation(modalProgram, "u_background");

  modalBgTex = modalGl.createTexture();
  modalGl.enable(modalGl.BLEND);
  modalGl.blendFunc(modalGl.SRC_ALPHA, modalGl.ONE_MINUS_SRC_ALPHA);
}

initModalGlassWebGL();

img.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, bg);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.uniform2f(u_imageRes, img.width, img.height);

  if (modalGl && modalBgTex && modalProgram) {
    modalGl.bindTexture(modalGl.TEXTURE_2D, modalBgTex);
    modalGl.texImage2D(
      modalGl.TEXTURE_2D,
      0,
      modalGl.RGBA,
      modalGl.RGBA,
      modalGl.UNSIGNED_BYTE,
      img
    );
    modalGl.texParameteri(
      modalGl.TEXTURE_2D,
      modalGl.TEXTURE_MIN_FILTER,
      modalGl.LINEAR
    );
    modalGl.texParameteri(
      modalGl.TEXTURE_2D,
      modalGl.TEXTURE_MAG_FILTER,
      modalGl.LINEAR
    );
    modalGl.texParameteri(
      modalGl.TEXTURE_2D,
      modalGl.TEXTURE_WRAP_S,
      modalGl.CLAMP_TO_EDGE
    );
    modalGl.texParameteri(
      modalGl.TEXTURE_2D,
      modalGl.TEXTURE_WRAP_T,
      modalGl.CLAMP_TO_EDGE
    );
  }
};

img.src = "https://raw.githubusercontent.com/W3L33/files/refs/heads/main/IMG_0929.png";

const BOX_WIDTH = 420;
const BOX_HEIGHT = 260;

let current = [innerWidth / 2, innerHeight / 2];
let target  = [...current];

function updateLensTarget(clientX, clientY) {
  const [cx, cy] = current;
  const hw = BOX_WIDTH / 2;
  const hh = BOX_HEIGHT / 2;

  let nx = cx;
  let ny = cy;

  if (clientX < cx - hw) nx += clientX - (cx - hw);
  if (clientX > cx + hw) nx += clientX - (cx + hw);
  if (clientY < cy - hh) ny += clientY - (cy - hh);
  if (clientY > cy + hh) ny += clientY - (cy + hh);

  target = [nx, ny];
}

function isContactModalOpen() {
  const m = document.getElementById("contact-modal");
  return m && !m.classList.contains("hidden");
}

function setMainCanvasInteractive(on) {
  canvas.style.pointerEvents = on ? "auto" : "none";
}

canvas.addEventListener("mousemove", e => {
  if (isContactModalOpen()) return;
  updateLensTarget(e.clientX, e.clientY);
});

canvas.addEventListener(
  "touchmove",
  e => {
    if (isContactModalOpen()) return;
    const t = e.touches[0];
    if (t) updateLensTarget(t.clientX, t.clientY);
  },
  { passive: true }
);

const icons = document.getElementById("icons");
let last = performance.now();

function drawModalGlass() {
  const modalEl = document.getElementById("contact-modal");
  if (
    !modalGl ||
    !modalProgram ||
    !modalBgTex ||
    !modalContent ||
    !img.complete ||
    !modalEl ||
    modalEl.classList.contains("hidden")
  ) {
    return;
  }

  const r = modalContent.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(r.width * dpr));
  const h = Math.max(1, Math.floor(r.height * dpr));

  if (modalGlassCanvas.width !== w || modalGlassCanvas.height !== h) {
    modalGlassCanvas.width = w;
    modalGlassCanvas.height = h;
  }

  modalGl.viewport(0, 0, w, h);
  modalGl.clearColor(0, 0, 0, 0);
  modalGl.clear(modalGl.COLOR_BUFFER_BIT);

  modalGl.useProgram(modalProgram);
  modalGl.bindBuffer(modalGl.ARRAY_BUFFER, modalBuffer);
  modalGl.enableVertexAttribArray(modalPos);
  modalGl.vertexAttribPointer(modalPos, 2, modalGl.FLOAT, false, 0, 0);

  modalGl.activeTexture(modalGl.TEXTURE0);
  modalGl.bindTexture(modalGl.TEXTURE_2D, modalBgTex);
  modalGl.uniform1i(modalU_sampler, 0);

  modalGl.uniform2f(modalU_resolution, w, h);
  modalGl.uniform2f(modalU_viewport, innerWidth, innerHeight);
  modalGl.uniform4f(modalU_rect, r.left, r.top, r.width, r.height);
  modalGl.uniform2f(modalU_imageRes, img.width, img.height);

  modalGl.drawArrays(modalGl.TRIANGLES, 0, 6);
}

function draw(t) {
  const dt = (t - last) / 1000;
  last = t;

  const speed = 7;
  current[0] += (target[0] - current[0]) * speed * dt;
  current[1] += (target[1] - current[1]) * speed * dt;

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(u_resolution, canvas.width, canvas.height);
  gl.uniform2f(u_viewport, innerWidth, innerHeight);
  gl.uniform2f(u_mouse, current[0], current[1]);
  gl.uniform2f(u_size, BOX_WIDTH, BOX_HEIGHT);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, bg);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  icons.style.transform =
    `translate(${current[0]}px, ${current[1]}px) translate(-50%, -50%)`;

  drawModalGlass();

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

const contactBtn = document.querySelector(".glass-btn:nth-child(3)");
const modal = document.getElementById("contact-modal");
const closeModalX = document.getElementById("close-modal-x");

function closeContactModal() {
  modal.classList.add("hidden");
  setMainCanvasInteractive(true);
}

contactBtn.addEventListener("click", () => {
  modal.classList.remove("hidden");
  setMainCanvasInteractive(false);
  window.dispatchEvent(new CustomEvent("contact-modal-open"));
});

closeModalX.addEventListener("click", closeContactModal);

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeContactModal();
  }
});


