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
const u_bgReadyLoc = gl.getUniformLocation(program, "u_bgReady");
const u_entranceAlphaLoc = gl.getUniformLocation(program, "u_entranceAlpha");

gl.uniform1f(gl.getUniformLocation(program, "u_dpr"), devicePixelRatio || 1);
gl.uniform1i(gl.getUniformLocation(program, "u_background"), 0);
gl.uniform1f(u_bgReadyLoc, 0.0);
gl.uniform1f(u_entranceAlphaLoc, 1.0);

/* Background image */
const bg = gl.createTexture();
const img = new Image();
img.crossOrigin = "anonymous";
const pageLoader = document.getElementById("page-loader");
let glassEntranceStart = null;
const BG_IMAGE_URL =
  "https://raw.githubusercontent.com/W3L33/files/refs/heads/main/IMG_0929.png";
let blobUrlToRevoke = null;

function setPageLoaderProgress(pct) {
  const root = pageLoader;
  const txt = document.getElementById("page-loader-pct");
  if (!txt || !root) return;
  if (pct == null || !Number.isFinite(pct)) {
    root.classList.add("page-loader--indeterminate");
    txt.textContent = "…";
    return;
  }
  root.classList.remove("page-loader--indeterminate");
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  txt.textContent = `${p}%`;
}

function loadBackgroundImageDirect() {
  blobUrlToRevoke = null;
  setPageLoaderProgress(null);
  img.src = BG_IMAGE_URL;
}

function loadBackgroundImageWithProgress() {
  setPageLoaderProgress(0);
  const xhr = new XMLHttpRequest();
  xhr.open("GET", BG_IMAGE_URL);
  xhr.responseType = "blob";
  xhr.onprogress = (e) => {
    if (e.lengthComputable && e.total > 0) {
      setPageLoaderProgress((100 * e.loaded) / e.total);
    } else {
      setPageLoaderProgress(null);
    }
  };
  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      loadBackgroundImageDirect();
      return;
    }
    const blobUrl = URL.createObjectURL(xhr.response);
    blobUrlToRevoke = blobUrl;
    setPageLoaderProgress(100);
    img.src = blobUrl;
  };
  xhr.onerror = () => loadBackgroundImageDirect();
  xhr.send();
}
const STORAGE_GLASS_ENTRANCE_AT = "w3l33_glass_entrance_at";
const STORAGE_GLASS_ENTRANCE_SEEN_LEGACY = "w3l33_glass_entrance_seen";
const GLASS_ENTRANCE_COOLDOWN_MS = 5 * 60 * 1000;

function shouldSkipGlassEntrance() {
  try {
    let raw = localStorage.getItem(STORAGE_GLASS_ENTRANCE_AT);
    if (raw == null && localStorage.getItem(STORAGE_GLASS_ENTRANCE_SEEN_LEGACY) === "1") {
      localStorage.setItem(STORAGE_GLASS_ENTRANCE_AT, String(Date.now()));
      localStorage.removeItem(STORAGE_GLASS_ENTRANCE_SEEN_LEGACY);
      return true;
    }
    if (raw == null) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < GLASS_ENTRANCE_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markGlassEntranceDone() {
  try {
    localStorage.setItem(STORAGE_GLASS_ENTRANCE_AT, String(Date.now()));
    localStorage.removeItem(STORAGE_GLASS_ENTRANCE_SEEN_LEGACY);
  } catch {
    /* private mode / quota */
  }
}

function hidePageLoader() {
  if (!pageLoader) return;
  pageLoader.classList.remove("page-loader--indeterminate");
  pageLoader.classList.add("page-loader--hidden");
  pageLoader.setAttribute("aria-busy", "false");
  pageLoader.setAttribute("aria-hidden", "true");
}

function startPublicIntroPulse() {
  const btn = document.getElementById("btn-public");
  if (!btn) return;
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    btn.removeEventListener("animationend", onPulseEnd);
    btn.classList.remove("glass-btn--public-pulse");
  };
  const onPulseEnd = (e) => {
    if (e.animationName !== "public-intro-pulse") return;
    cleanup();
  };
  const fallbackTimer = setTimeout(cleanup, 3200);
  btn.addEventListener("animationend", onPulseEnd);
  btn.classList.add("glass-btn--public-pulse");
}

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
  if (blobUrlToRevoke) {
    URL.revokeObjectURL(blobUrlToRevoke);
    blobUrlToRevoke = null;
  }
  gl.useProgram(program);
  gl.bindTexture(gl.TEXTURE_2D, bg);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.uniform2f(u_imageRes, img.width, img.height);
  gl.uniform1f(u_bgReadyLoc, 1.0);
  if (!shouldSkipGlassEntrance()) {
    glassEntranceStart = performance.now();
  }

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

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hidePageLoader();
      const ic = document.getElementById("icons");
      if (ic) ic.classList.remove("icons-awaiting-bg");
      startPublicIntroPulse();
    });
  });
};

img.addEventListener("error", () => {
  if (blobUrlToRevoke) {
    URL.revokeObjectURL(blobUrlToRevoke);
    blobUrlToRevoke = null;
    setPageLoaderProgress(0);
    img.src = BG_IMAGE_URL;
    return;
  }
  hidePageLoader();
  gl.useProgram(program);
  gl.uniform1f(u_bgReadyLoc, 1.0);
  const ic = document.getElementById("icons");
  if (ic) ic.classList.remove("icons-awaiting-bg");
});

loadBackgroundImageWithProgress();

const BOX_WIDTH = 420;
const BOX_HEIGHT = 260;
const GLASS_ENTRANCE_MS = 1000;
const GLASS_ENTRANCE_DRIFT_PX = 36;

let current = [innerWidth / 2, innerHeight / 2];
let target  = [...current];

function getGlassEntranceState() {
  let mx = current[0];
  let my = current[1];
  let alpha = 1;
  if (glassEntranceStart == null) {
    return { mx, my, alpha };
  }
  const elapsed = performance.now() - glassEntranceStart;
  if (elapsed >= GLASS_ENTRANCE_MS) {
    glassEntranceStart = null;
    markGlassEntranceDone();
    return { mx: current[0], my: current[1], alpha: 1 };
  }
  const t = elapsed / GLASS_ENTRANCE_MS;
  const easePos = t * t * (3 - 2 * t);
  const easeFade = easePos * easePos;
  alpha = easeFade;
  const drift = GLASS_ENTRANCE_DRIFT_PX * (1 - easePos);
  mx = current[0];
  my = current[1] + drift;
  return { mx, my, alpha };
}

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

  const { mx, my, alpha: entranceAlpha } = getGlassEntranceState();

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(u_resolution, canvas.width, canvas.height);
  gl.uniform2f(u_viewport, innerWidth, innerHeight);
  gl.uniform2f(u_mouse, mx, my);
  gl.uniform2f(u_size, BOX_WIDTH, BOX_HEIGHT);
  gl.uniform1f(u_entranceAlphaLoc, entranceAlpha);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, bg);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  if (icons) {
    icons.style.transform =
      `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    icons.style.opacity = entranceAlpha >= 0.999 ? "" : String(entranceAlpha);
  }

  drawModalGlass();

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

const contactBtn = document.querySelector(".glass-btn:nth-child(3)");
const modal = document.getElementById("contact-modal");
const closeModalX = document.getElementById("close-modal-x");
const CONTACT_REDIRECT_ON_CLOSE_URL = "https://welee.netlify.app/";
const STORAGE_CONTACT_MESSAGE_SENT_KEY = "w3l33_contact_message_sent";

function contactMessagePersistedInStorage() {
  try {
    return localStorage.getItem(STORAGE_CONTACT_MESSAGE_SENT_KEY) === "1";
  } catch {
    return false;
  }
}

function closeContactModal() {
  if (!modal) return;
  modal.classList.add("hidden");
  setMainCanvasInteractive(true);
  window.dispatchEvent(new CustomEvent("contact-modal-close"));
  if (window.__w3l33ContactSentOk === true || contactMessagePersistedInStorage()) {
    return;
  }
  window.location.assign(CONTACT_REDIRECT_ON_CLOSE_URL);
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

modal.addEventListener(
  "touchend",
  e => {
    if (e.target !== modal) return;
    e.preventDefault();
    closeContactModal();
  },
  { passive: false }
);


