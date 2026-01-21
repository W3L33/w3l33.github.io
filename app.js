const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl", { antialias: true });

gl.clearColor(0, 0, 0, 1);

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
resize();

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
img.src = "https://raw.githubusercontent.com/W3L33/files/refs/heads/main/IMG_0929.png";

img.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, bg);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.uniform2f(u_imageRes, img.width, img.height);
};

const BOX_WIDTH = 420;
const BOX_HEIGHT = 260;

let current = [innerWidth / 2, innerHeight / 2];
let target  = [...current];

canvas.addEventListener("mousemove", e => {
  const [cx, cy] = current;
  const hw = BOX_WIDTH / 2;
  const hh = BOX_HEIGHT / 2;

  let nx = cx;
  let ny = cy;

  if (e.clientX < cx - hw) nx += e.clientX - (cx - hw);
  if (e.clientX > cx + hw) nx += e.clientX - (cx + hw);
  if (e.clientY < cy - hh) ny += e.clientY - (cy - hh);
  if (e.clientY > cy + hh) ny += e.clientY - (cy + hh);

  target = [nx, ny];
});

const icons = document.getElementById("icons");
let last = performance.now();

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

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

const contactBtn = document.querySelector(".glass-btn:nth-child(3)");
const modal = document.getElementById("contact-modal");
const closeModal = document.getElementById("close-modal");

contactBtn.addEventListener("click", () => {
  modal.classList.remove("hidden");
});

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.add("hidden");
  }
});
const EMAILJS_CONFIG = {
  publicKey: "xjrJOvmRPX-xOOMhk",
  serviceId: "service_vo1fbe5",
  templateId: "contact_notification"
};

emailjs.init(EMAILJS_CONFIG.publicKey);

const form = document.getElementById("contact-form");
const statusBox = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", e => {
  e.preventDefault();

  submitBtn.disabled = true;
  statusBox.classList.add("hidden");

  emailjs.sendForm(
    EMAILJS_CONFIG.serviceId,
    EMAILJS_CONFIG.templateId,
    form
  )
  .then(() => {
    statusBox.innerHTML =
      "<p style='color:#4ade80'>Mensaje enviado correctamente ✔</p>";
    statusBox.classList.remove("hidden");
    form.reset();

    setTimeout(() => {
      modal.classList.add("hidden");
    }, 1200);
  })
  .catch(err => {
    console.error(err);
    statusBox.innerHTML =
      "<p style='color:#f87171'>Error al enviar el mensaje</p>";
    statusBox.classList.remove("hidden");
  })
  .finally(() => {
    submitBtn.disabled = false;
  });
});

