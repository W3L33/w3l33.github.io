const EMAILJS_CONFIG = {
  publicKey: "xjrJOvmRPX-xOOMhk",
  serviceId: "service_njndtr9",
  notificationTemplateId: "contact_notification",
  autoResponseTemplateId: "autoresponder"
};

const COOLDOWN_STORAGE_KEY = "cv_contactFormCooldownUntil";
const COOLDOWN_MS = 10 * 60 * 1000;
const CONTACT_SUCCESS_REPLACEMENT_MS = 5000;
const FIELD_BLOCK_MS = 2500;

function initEmailJS() {
  emailjs.init(EMAILJS_CONFIG.publicKey);
}

initEmailJS();

const form = document.getElementById("contact-form");
const statusBox = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");
const nameInput = document.getElementById("contact-name");
const emailInput = document.getElementById("contact-email");
const phoneInput = document.getElementById("contact-phone");
const messageInput = document.getElementById("contact-message");

const submitBtnDefaultLabel = submitBtn.textContent.trim() || "Enviar";

let formSubmitting = false;
let successReplaceTimer = null;

function isValidEmail(value) {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function phoneDigits(value) {
  return String(value).replace(/\D/g, "");
}

function isValidPhone10(value) {
  return phoneDigits(value).length === 10;
}

function validateContactForm() {
  return (
    nameInput.value.trim().length > 0 &&
    isValidEmail(emailInput.value) &&
    isValidPhone10(phoneInput.value) &&
    messageInput.value.trim().length > 0
  );
}

function getCooldownCookieRaw() {
  const prefix = COOLDOWN_STORAGE_KEY + "=";
  const parts = document.cookie.split("; ");
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].indexOf(prefix) === 0) {
      return decodeURIComponent(parts[i].substring(prefix.length));
    }
  }
  return null;
}

function setCooldownCookie(value, maxAgeSec) {
  let c =
    COOLDOWN_STORAGE_KEY +
    "=" +
    encodeURIComponent(value) +
    "; path=/; SameSite=Lax; max-age=" +
    Math.floor(maxAgeSec);
  if (typeof location !== "undefined" && location.protocol === "https:") {
    c += "; Secure";
  }
  document.cookie = c;
}

function eraseCooldownCookie() {
  document.cookie =
    COOLDOWN_STORAGE_KEY + "=; path=/; SameSite=Lax; max-age=0";
}

function readCooldownUntilMs() {
  let raw = null;
  try {
    raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
  } catch (e) {
    raw = null;
  }
  if (raw != null && String(raw).trim() !== "") {
    const n = Number(String(raw).trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  raw = getCooldownCookieRaw();
  if (raw != null && String(raw).trim() !== "") {
    const n = Number(String(raw).trim());
    if (Number.isFinite(n) && n > 0) {
      try {
        localStorage.setItem(COOLDOWN_STORAGE_KEY, String(n));
      } catch (e) {}
      return n;
    }
  }
  return null;
}

function writeCooldownUntilMs(untilMs) {
  const v = String(untilMs);
  try {
    localStorage.setItem(COOLDOWN_STORAGE_KEY, v);
  } catch (e) {}
  const maxAge = Math.max(60, Math.ceil((untilMs - Date.now()) / 1000));
  setCooldownCookie(v, maxAge);
}

function clearCooldownStorage() {
  try {
    localStorage.removeItem(COOLDOWN_STORAGE_KEY);
  } catch (e) {}
  eraseCooldownCookie();
}

function isContactFormInCooldown() {
  const until = readCooldownUntilMs();
  if (until == null) return false;
  if (Date.now() < until) return true;
  clearCooldownStorage();
  return false;
}

function upsertHiddenField(formEl, name, value) {
  let input = formEl.querySelector('input[type="hidden"][name="' + name + '"]');
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    formEl.appendChild(input);
  }
  input.value = value;
}

function syncEmailTemplateFields(formEl, fromNameValue, replyToValue) {
  upsertHiddenField(formEl, "to_name", fromNameValue);
  upsertHiddenField(formEl, "to_email", replyToValue);
  let timeStr = "";
  try {
    timeStr = new Date().toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch (e) {
    timeStr = new Date().toISOString();
  }
  upsertHiddenField(formEl, "time", timeStr);
}

function getErrorMessage(err) {
  const status =
    err && (typeof err.status === "number" ? err.status : err.statusCode);
  const detail =
    err && (err.text || err.message)
      ? String(err.text || err.message).slice(0, 200)
      : "";

  if (status === 400) {
    return "Error de configuración (400). Revisa plantilla y variables en EmailJS." + (detail ? " " + detail : "");
  }
  if (status === 401) {
    return "Clave pública o credenciales no válidas (401).";
  }
  if (status === 403) {
    return "Dominio no autorizado para esta clave (403).";
  }
  if (status === 404) {
    return "Servicio o plantilla no encontrado (404). Comprueba los IDs en EmailJS.";
  }
  if (status === 429) {
    return "Demasiadas solicitudes (429). Intenta más tarde.";
  }
  if (status >= 500) {
    return "Error del servidor (" + status + "). Intenta más tarde.";
  }
  if (status === 0 || status === undefined) {
    return "No se pudo conectar. Revisa tu red o bloqueos del navegador.";
  }
  return "No se pudo completar el envío (" + (status || "?") + ")." + (detail ? " " + detail : "");
}

function clearSuccessReplaceTimer() {
  if (successReplaceTimer) {
    clearTimeout(successReplaceTimer);
    successReplaceTimer = null;
  }
}

function cooldownNoticeHtml() {
  const until = readCooldownUntilMs();
  let line =
    "Entre envíos completos debes esperar 10 minutos antes de usar el formulario de nuevo.";
  if (until != null && Date.now() < until) {
    const minLeft = Math.max(1, Math.ceil((until - Date.now()) / 60000));
    line +=
      " Tiempo aproximado restante: " + minLeft + " min.";
  }
  return "<p style='color:#fcd34d'>" + line + "</p>";
}

function setFormFieldsBlocked(blocked) {
  [nameInput, emailInput, phoneInput, messageInput, submitBtn].forEach(el => {
    if (!el) return;
    el.disabled = blocked;
  });
}

function updateSubmitEnabled() {
  submitBtn.disabled =
    formSubmitting ||
    !validateContactForm() ||
    isContactFormInCooldown();
}

phoneInput.addEventListener("input", () => {
  phoneInput.value = phoneDigits(phoneInput.value).slice(0, 10);
  updateSubmitEnabled();
});

[nameInput, emailInput, messageInput].forEach(el => {
  el.addEventListener("input", updateSubmitEnabled);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateSubmitEnabled();
});

window.addEventListener("contact-modal-open", () => {
  updateSubmitEnabled();
});

updateSubmitEnabled();

if (isContactFormInCooldown()) {
  statusBox.innerHTML = cooldownNoticeHtml();
  statusBox.classList.remove("hidden");
  updateSubmitEnabled();
}

form.addEventListener("submit", e => {
  e.preventDefault();
  clearSuccessReplaceTimer();

  if (!validateContactForm()) {
    updateSubmitEnabled();
    return;
  }

  if (isContactFormInCooldown()) {
    statusBox.innerHTML =
      "<p style='color:#f87171'>Debes esperar 10 minutos entre envíos exitosos. Intenta más tarde.</p>";
    statusBox.classList.remove("hidden");
    updateSubmitEnabled();
    return;
  }

  const fromNameTrim = nameInput.value.trim();
  const replyToTrim = emailInput.value.trim();
  syncEmailTemplateFields(form, fromNameTrim, replyToTrim);

  formSubmitting = true;
  submitBtn.textContent = "Enviando…";
  updateSubmitEnabled();
  statusBox.classList.add("hidden");

  const emailJobs = [
    { label: "notificación", templateId: EMAILJS_CONFIG.notificationTemplateId },
    { label: "autorespuesta", templateId: EMAILJS_CONFIG.autoResponseTemplateId }
  ];

  Promise.allSettled(
    emailJobs.map(job =>
      emailjs.sendForm(EMAILJS_CONFIG.serviceId, job.templateId, form)
    )
  )
    .then(results => {
      const failedJobs = [];
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          failedJobs.push({ label: emailJobs[i].label, reason: r.reason });
        }
      });

      if (failedJobs.length === 0) {
        writeCooldownUntilMs(Date.now() + COOLDOWN_MS);
        statusBox.innerHTML =
          "<p style='color:#4ade80'>Mensaje enviado correctamente ✔</p>";
        statusBox.classList.remove("hidden");
        form.reset();
        setFormFieldsBlocked(true);
        setTimeout(() => {
          setFormFieldsBlocked(false);
          updateSubmitEnabled();
        }, FIELD_BLOCK_MS);

        successReplaceTimer = setTimeout(() => {
          successReplaceTimer = null;
          statusBox.innerHTML = cooldownNoticeHtml();
        }, CONTACT_SUCCESS_REPLACEMENT_MS);
        return;
      }

      failedJobs.forEach(j => {
        console.error("[EmailJS] Fallo:", j.label, j.reason);
      });

      if (failedJobs.length === 1) {
        const okIdx = results.findIndex(x => x.status === "fulfilled");
        const okJobLabel = okIdx >= 0 ? emailJobs[okIdx].label : "";
        statusBox.innerHTML =
          "<p style='color:#f87171'>Falló " +
          failedJobs[0].label +
          ": " +
          getErrorMessage(failedJobs[0].reason) +
          " La otra parte (" +
          okJobLabel +
          ") se envió correctamente.</p>";
        statusBox.classList.remove("hidden");
        form.reset();
        return;
      }

      const firstErr = getErrorMessage(failedJobs[0].reason);
      statusBox.innerHTML =
        "<p style='color:#f87171'>" +
        firstErr +
        " Si el problema continúa, contáctame directamente.</p>";
      statusBox.classList.remove("hidden");
    })
    .catch(err => {
      console.error(err);
      statusBox.innerHTML =
        "<p style='color:#f87171'>" +
        getErrorMessage(err) +
        " Si el problema continúa, contáctame directamente.</p>";
      statusBox.classList.remove("hidden");
    })
    .finally(() => {
      formSubmitting = false;
      submitBtn.textContent = submitBtnDefaultLabel;
      updateSubmitEnabled();
    });
});
