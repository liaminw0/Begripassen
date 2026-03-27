const viewConfig = {
  events: {
    eyebrow: "Events",
    title: "Events maken en bijwerken",
    listTitle: "Bestaande events",
    buttonLabel: "Nieuw event",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true },
      { name: "date", label: "Datum en tijd", type: "datetime-local", required: true },
      { name: "location", label: "Locatie", type: "text" },
      { name: "organiser", label: "Organisator", type: "text" },
      { name: "image", label: "Omslagafbeelding", type: "image" },
      { name: "show_signup", label: "Aanmeldknop tonen", type: "checkbox" },
      { name: "signup_link", label: "Aanmeldlink", type: "url" },
      { name: "draft", label: "Concept", type: "checkbox" },
      { name: "body", label: "Inhoud", type: "markdown", required: true },
    ],
  },
  blogs: {
    eyebrow: "Blogs",
    title: "Blogs schrijven en publiceren",
    listTitle: "Bestaande blogs",
    buttonLabel: "Nieuwe blog",
    fields: [
      { name: "title", label: "Titel", type: "text", required: true },
      { name: "date", label: "Publicatiedatum", type: "date", required: true },
      { name: "author", label: "Auteur", type: "text" },
      { name: "image", label: "Omslagafbeelding", type: "image" },
      { name: "draft", label: "Concept", type: "checkbox" },
      { name: "body", label: "Inhoud", type: "markdown", required: true },
    ],
  },
  home: {
    eyebrow: "Homepagina",
    title: "Homepagina bijwerken",
    listTitle: "Homepagina",
    buttonLabel: "Homepagina openen",
    fields: [
      { name: "heading", label: "Hoofdtekst", type: "textarea", rows: 4, required: true, group: "intro" },
      { name: "about", label: "Over ons", type: "textarea", rows: 4, required: true, group: "about" },
      { name: "about_image", label: "Over ons afbeelding", type: "image", group: "about" },
      { name: "about_link_text", label: "Over ons knoptekst", type: "text", group: "about" },
      { name: "about_link_url", label: "Over ons knoplink", type: "url", group: "about" },
      { name: "blog", label: "Blog intro", type: "textarea", rows: 4, required: true, group: "blog" },
      { name: "newsletter", label: "Nieuwsbrief intro", type: "textarea", rows: 4, required: true, group: "newsletter" },
      { name: "support", label: "Steun ons intro", type: "textarea", rows: 4, required: true, group: "support" },
      { name: "contact", label: "Contact intro", type: "textarea", rows: 4, required: true, group: "contact" },
      { name: "contact_phone_label", label: "Telefoon label", type: "text", layout: "third", rowGroup: "contact-phone", group: "contact" },
      { name: "contact_phone", label: "Telefoonnummer", type: "text", layout: "third", rowGroup: "contact-phone", group: "contact" },
      { name: "contact_email_label", label: "E-mail label", type: "text", layout: "third", rowGroup: "contact-email", group: "contact" },
      { name: "contact_email", label: "E-mailadres", type: "text", layout: "third", rowGroup: "contact-email", group: "contact" },
      { name: "contact_instagram_label", label: "Instagram label", type: "text", layout: "third", rowGroup: "contact-instagram", group: "contact" },
      { name: "contact_instagram_handle", label: "Instagram naam", type: "text", layout: "third", rowGroup: "contact-instagram", group: "contact" },
      { name: "contact_instagram_url", label: "Instagram link", type: "url", layout: "third", rowGroup: "contact-instagram", group: "contact" },
    ],
  },
};

const homeEditorCards = [
  {
    eyebrow: "Bovenaan",
    title: "Intro en over ons",
    description: "De eerste indruk van de homepagina, plus het blok waarin BEGR!P wordt uitgelegd.",
    sections: [
      { id: "intro", title: "Intro" },
      { id: "about", title: "Over ons" },
    ],
  },
  {
    eyebrow: "Midden",
    title: "Blog en nieuwsbrief",
    description: "De twee inhoudsblokken waarmee bezoekers verder lezen of zich aanmelden.",
    sections: [
      { id: "blog", title: "Blog" },
      { id: "newsletter", title: "Nieuwsbrief" },
    ],
  },
  {
    eyebrow: "Onderaan",
    title: "Steun ons en contact",
    description: "De slotsecties van de homepage met oproep en contactinformatie.",
    sections: [
      { id: "support", title: "Steun ons" },
      { id: "contact", title: "Contact" },
    ],
  },
];

const state = {
  activeView: "home",
  authenticated: false,
  currentItem: null,
  editorMode: "empty",
  lists: {
    events: [],
    blogs: [],
  },
};

const elements = {
  loginPanel: document.getElementById("login-panel"),
  dashboardPanel: document.getElementById("dashboard-panel"),
  loginForm: document.getElementById("login-form"),
  passwordInput: document.getElementById("password-input"),
  loginError: document.getElementById("login-error"),
  logoutButton: document.getElementById("logout-button"),
  nav: document.getElementById("cms-nav"),
  sidebarTitle: document.getElementById("sidebar-title"),
  sidebarCopy: document.getElementById("sidebar-copy"),
  dashboardGrid: document.getElementById("dashboard-grid"),
  listCard: document.getElementById("list-card"),
  contentList: document.getElementById("content-list"),
  editorEmpty: document.getElementById("editor-empty"),
  editorEmptyEyebrow: document.getElementById("editor-empty-eyebrow"),
  editorEmptyTitle: document.getElementById("editor-empty-title"),
  editorEmptyCopy: document.getElementById("editor-empty-copy"),
  editorForm: document.getElementById("editor-form"),
  editorFields: document.getElementById("editor-fields"),
  editorMeta: document.getElementById("editor-meta"),
  editorMessage: document.getElementById("editor-message"),
  deleteButton: document.getElementById("delete-button"),
  newItemButton: document.getElementById("new-item-button"),
  refreshButton: document.getElementById("refresh-button"),
  viewEyebrow: document.getElementById("view-eyebrow"),
  viewTitle: document.getElementById("view-title"),
  listTitle: document.getElementById("list-title"),
  navButtons: [...document.querySelectorAll(".cms-nav button")],
  itemTemplate: document.getElementById("list-item-template"),
};

function setMessage(message, tone = "") {
  elements.editorMessage.textContent = message || "";
  elements.editorMessage.className = tone ? `form-message ${tone}` : "form-message";
}

function setLoginError(message) {
  elements.loginError.textContent = message || "";
}

function updateSidebarCopy() {
  if (state.authenticated) {
    elements.sidebarTitle.textContent = "Inhoud beheren";
    elements.sidebarCopy.textContent = "Maak nieuwe events en blogposts, werk homepage-teksten bij en upload beelden.";
    return;
  }

  elements.sidebarTitle.textContent = "Teamomgeving";
  elements.sidebarCopy.textContent = "Log in om de website van BEGR!P bij te werken en nieuwe inhoud te publiceren.";
}

function setEditorMode(mode) {
  state.editorMode = mode;
  const showForm = mode === "editing";
  elements.editorEmpty.classList.toggle("hidden", showForm);
  elements.editorForm.classList.toggle("hidden", !showForm);
  elements.deleteButton.classList.toggle("hidden", !showForm || state.activeView === "home");
}

function showEmptyEditorState() {
  const config = viewConfig[state.activeView];
  state.currentItem = null;
  setEditorMode("empty");
  elements.editorFields.innerHTML = "";
  elements.editorMeta.innerHTML = "";
  elements.editorMeta.classList.add("hidden");
  elements.editorEmptyEyebrow.textContent = config.eyebrow;

  if (state.activeView === "home") {
    elements.editorEmptyTitle.textContent = "Homepagina wordt geladen";
    elements.editorEmptyCopy.textContent = "De homepagina heeft geen losse lijstweergave nodig en opent direct in de editor.";
  } else {
    elements.editorEmptyTitle.textContent = "Kies eerst een item";
    elements.editorEmptyCopy.textContent = `Selecteer links een bestaand ${state.activeView === "events" ? "evenement" : "blogartikel"} of klik op "${config.buttonLabel}" om een nieuw item te openen.`;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

function toInputDateTime(value) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toInputDate(value) {
  if (!value) {
    return "";
  }

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFieldMarkup(field, value = "") {
  if (field.type === "checkbox") {
    return `
      <label class="checkbox-field" data-field-wrapper="${field.name}">
        <input type="checkbox" name="${field.name}" ${value ? "checked" : ""} />
        <span>${field.label}</span>
      </label>
    `;
  }

  if (field.type === "textarea" || field.type === "markdown") {
    const rows = field.rows || (field.type === "markdown" ? 12 : 4);
    return `
      <label>
        ${field.label}
        <textarea name="${field.name}" rows="${rows}" ${field.required ? "required" : ""}>${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  if (field.type === "image") {
    const previewMarkup = value
      ? `<div class="image-preview" data-image-preview="${field.name}"><img src="${escapeHtml(value)}" alt="${escapeHtml(field.label)}" loading="lazy" /></div>`
      : `<div class="image-preview hidden" data-image-preview="${field.name}"><img src="" alt="${escapeHtml(field.label)}" loading="lazy" /></div>`;

    return `
      <label data-image-field="${field.name}" data-field-wrapper="${field.name}">
        ${field.label}
        <input type="hidden" name="${field.name}" value="${escapeHtml(value)}" />
        ${previewMarkup}
        <div class="upload-row">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload-input="${field.name}" class="hidden-upload-input" />
          <button type="button" class="secondary" data-upload-button="${field.name}">Kies en upload afbeelding</button>
        </div>
      </label>
    `;
  }

  const normalizedValue =
    field.type === "datetime-local" ? toInputDateTime(value) : field.type === "date" ? toInputDate(value) : value;

  return `
    <label data-field-wrapper="${field.name}" data-field-layout="${field.layout || ""}">
      ${field.label}
      <input type="${field.type}" name="${field.name}" value="${escapeHtml(normalizedValue)}" ${field.required ? "required" : ""} />
    </label>
    `;
}

function applyFieldVisibilityRules() {
  if (state.activeView !== "events") {
    return;
  }

  const signupToggle = elements.editorFields.querySelector('input[name="show_signup"]');
  const signupLinkWrapper = elements.editorFields.querySelector('[data-field-wrapper="signup_link"]');

  if (!signupToggle || !signupLinkWrapper) {
    return;
  }

  const updateSignupLinkVisibility = () => {
    const visible = signupToggle.checked;
    signupLinkWrapper.classList.toggle("hidden", !visible);

    if (!visible) {
      const signupLinkInput = signupLinkWrapper.querySelector('input[name="signup_link"]');
      if (signupLinkInput) {
        signupLinkInput.value = "";
      }
    }
  };

  signupToggle.addEventListener("change", updateSignupLinkVisibility);
  updateSignupLinkVisibility();
}

function renderFieldRows(fields, item) {
  const gridMarkup = [];
  let currentRow = [];
  let currentLayout = "pair";
  let currentRowGroup = "";

  const flushCurrentRow = () => {
    if (!currentRow.length) {
      return;
    }
    const gridClass = currentLayout === "third" ? "field-grid field-grid-third" : "field-grid";
    gridMarkup.push(`<div class="${gridClass}">${currentRow.join("")}</div>`);
    currentRow = [];
  };

  for (const field of fields) {
    const fieldValue = field.name === "body" ? item?.body || "" : item?.fields?.[field.name] || "";
    const markup = buildFieldMarkup(field, fieldValue);
    const isBlockField = field.type === "textarea" || field.type === "markdown" || field.type === "image" || field.type === "checkbox";
    const layout = field.layout || "pair";
    const rowGroup = field.rowGroup || "";

    if (isBlockField) {
      flushCurrentRow();
      gridMarkup.push(markup);
      currentLayout = "pair";
      currentRowGroup = "";
    } else {
      if (currentRow.length && (currentLayout !== layout || (currentRowGroup && currentRowGroup !== rowGroup))) {
        flushCurrentRow();
      }

      currentLayout = layout;
      currentRowGroup = rowGroup;
      currentRow.push(markup);
      const maxColumns = layout === "third" ? 3 : 2;

      if (currentRow.length === maxColumns) {
        flushCurrentRow();
      }
    }
  }

  flushCurrentRow();
  return gridMarkup.join("");
}

function renderHomeEditor(item) {
  const cardMarkup = homeEditorCards
    .map((card) => {
      const sectionMarkup = card.sections
        .map((section) => {
          const sectionFields = viewConfig.home.fields.filter((field) => field.group === section.id);
          if (!sectionFields.length) {
            return "";
          }

          return `
            <section class="editor-subsection">
              <h4>${section.title}</h4>
              <div class="editor-subsection-fields">
                ${renderFieldRows(sectionFields, item)}
              </div>
            </section>
          `;
        })
        .join("");

      if (!sectionMarkup) {
        return "";
      }

      return `
        <section class="editor-section-card">
          <div class="editor-section-head">
            <p class="eyebrow">${card.eyebrow}</p>
            <h3>${card.title}</h3>
            <p>${card.description}</p>
          </div>
          <div class="editor-section-fields">
            ${sectionMarkup}
          </div>
        </section>
      `;
    })
    .join("");

  elements.editorFields.innerHTML = `<div class="editor-section-stack">${cardMarkup}</div>`;
}

function renderEditor(item = null) {
  state.currentItem = item;
  setEditorMode("editing");
  const config = viewConfig[state.activeView];
  if (state.activeView === "home") {
    renderHomeEditor(item);
  } else {
    elements.editorFields.innerHTML = renderFieldRows(config.fields, item);
  }
  elements.editorMeta.innerHTML = item?.path ? `<div class="meta-chip">Bewerkt bestand: ${item.path}</div>` : "";
  elements.editorMeta.classList.toggle("hidden", !item?.path);
  setMessage(item ? "Bewerking geladen." : "");

  for (const button of elements.editorFields.querySelectorAll("[data-upload-button]")) {
    const fieldName = button.dataset.uploadButton;
    const fileInput = elements.editorFields.querySelector(`[data-upload-input="${fieldName}"]`);
    const targetInput = elements.editorFields.querySelector(`input[name="${fieldName}"]`);
    const preview = elements.editorFields.querySelector(`[data-image-preview="${fieldName}"]`);
    const previewImage = preview?.querySelector("img");

    const syncImagePreview = (value) => {
      if (!preview || !previewImage) {
        return;
      }

      const hasValue = Boolean(String(value || "").trim());
      preview.classList.toggle("hidden", !hasValue);
      previewImage.src = hasValue ? value : "";
    };

    targetInput?.addEventListener("input", () => {
      syncImagePreview(targetInput.value);
    });

    button.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];

      if (!file) {
        return;
      }

      try {
        setMessage("Afbeelding omzetten naar WebP...", "");
        const webpFile = await convertImageToWebP(file);
        setMessage("Afbeelding uploaden...", "");
        const base64 = await fileToBase64(webpFile);
        const payload = await api("/api/cms/upload", {
          method: "POST",
          body: JSON.stringify({
            filename: webpFile.name,
            mimeType: webpFile.type,
            base64,
          }),
        });
        targetInput.value = payload.path;
        syncImagePreview(payload.path);
        setMessage("Afbeelding geüpload als WebP en ingevuld.", "success");
      } catch (err) {
        setMessage(err.message, "error");
      } finally {
        fileInput.value = "";
      }
    });
  }

  applyFieldVisibilityRules();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",").pop());
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("De gekozen afbeelding kon niet worden geopend."));
    };
    image.src = url;
  });
}

async function convertImageToWebP(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Kies een geldige afbeelding.");
  }

  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Gebruik een PNG, JPG, GIF of WebP afbeelding.");
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("De browser kon de afbeelding niet verwerken.");
  }

  context.drawImage(image, 0, 0);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.9);
  });

  if (!blob) {
    throw new Error("De afbeelding kon niet naar WebP worden omgezet.");
  }

  const webpName = `${file.name.replace(/\.[^/.]+$/, "") || "afbeelding"}.webp`;
  return new File([blob], webpName, { type: "image/webp" });
}

function renderList() {
  const config = viewConfig[state.activeView];
  elements.viewEyebrow.textContent = config.eyebrow;
  elements.viewTitle.textContent = config.title;
  elements.listTitle.textContent = config.listTitle;
  elements.newItemButton.textContent = config.buttonLabel;
  elements.dashboardGrid.classList.toggle("is-home-layout", state.activeView === "home");
  elements.listCard.classList.toggle("hidden", state.activeView === "home");
  elements.newItemButton.classList.toggle("hidden", state.activeView === "home");
  elements.refreshButton.classList.toggle("hidden", state.activeView === "home");

  if (state.activeView === "home") {
    elements.contentList.innerHTML = "";
    return;
  }

  const items = state.lists[state.activeView] || [];
  if (!items.length) {
    elements.contentList.innerHTML = `<p class="list-item-summary">Nog geen items gevonden.</p>`;
    return;
  }

  elements.contentList.innerHTML = "";
  for (const item of items) {
    const node = elements.itemTemplate.content.cloneNode(true);
    node.querySelector(".list-item-eyebrow").textContent = formatListMeta(item);
    node.querySelector("h4").textContent = item.title;
    node.querySelector(".list-item-summary").textContent = item.summary;
    node.querySelector(".list-item-action").addEventListener("click", () => loadItem(item.path));
    elements.contentList.appendChild(node);
  }
}

async function loadSession() {
  const payload = await api("/api/cms/session", { method: "GET", headers: {} });
  state.authenticated = payload.authenticated;
  updateSidebarCopy();
  elements.loginPanel.classList.toggle("hidden", state.authenticated);
  elements.dashboardPanel.classList.toggle("hidden", !state.authenticated);
  elements.logoutButton.classList.toggle("hidden", !state.authenticated);
  elements.nav.classList.toggle("hidden", !state.authenticated);
  if (state.authenticated) {
    await refreshActiveView();
  }
}

async function refreshActiveView() {
  showEmptyEditorState();
  setMessage("");
  renderList();

  if (state.activeView === "home") {
    await loadHome();
    return;
  }

  const payload = await api(`/api/cms/items?type=${state.activeView}`, { method: "GET", headers: {} });
  state.lists[state.activeView] = payload.items;
  renderList();
}

async function loadItem(path) {
  const payload = await api(`/api/cms/items?type=${state.activeView}&path=${encodeURIComponent(path)}`, {
    method: "GET",
    headers: {},
  });
  renderEditor(payload.item);
}

async function loadHome() {
  const payload = await api("/api/cms/items?type=home", { method: "GET", headers: {} });
  renderEditor(payload.item);
}

function collectFormData() {
  const formData = new FormData(elements.editorForm);
  const config = viewConfig[state.activeView];
  const fields = {};

  for (const field of config.fields) {
    if (field.name === "body") {
      continue;
    }

    if (field.type === "checkbox") {
      fields[field.name] = formData.get(field.name) === "on";
    } else {
      fields[field.name] = String(formData.get(field.name) || "").trim();
    }
  }

  return {
    fields,
    body: String(formData.get("body") || "").trim(),
  };
}

function validatePayload(payload) {
  const config = viewConfig[state.activeView];
  for (const field of config.fields) {
    if (field.required) {
      const value = field.name === "body" ? payload.body : payload.fields[field.name];
      if (!value) {
        throw new Error(`Vul "${field.label}" in.`);
      }
    }
  }
}

function formatDutchDate(dateValue, withTime = false) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function hasExplicitTime(dateValue) {
  return typeof dateValue === "string" && dateValue.includes("T");
}

function formatListMeta(item) {
  const parts = [];
  const isEvent = item.type === "events";
  const formattedDate = formatDutchDate(item.date, isEvent && hasExplicitTime(item.date));

  if (formattedDate) {
    parts.push(formattedDate);
  }

  parts.push(item.draft ? "concept" : "gepubliceerd");
  return parts.join(" · ");
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError("");

  try {
    await api("/api/cms/login", {
      method: "POST",
      body: JSON.stringify({ password: elements.passwordInput.value }),
    });
    elements.passwordInput.value = "";
    await loadSession();
  } catch (err) {
    setLoginError(err.message);
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/cms/logout", { method: "POST", body: "{}" });
  state.authenticated = false;
  updateSidebarCopy();
  elements.loginPanel.classList.remove("hidden");
  elements.dashboardPanel.classList.add("hidden");
  elements.logoutButton.classList.add("hidden");
  elements.nav.classList.add("hidden");
  setMessage("");
});

elements.navButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    state.activeView = button.dataset.view;
    elements.navButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    await refreshActiveView();
  });
});

elements.newItemButton.addEventListener("click", async () => {
  if (state.activeView === "home") {
    await loadHome();
    return;
  }
  renderEditor();
  setMessage(`Nieuw ${state.activeView === "events" ? "evenement" : "blogartikel"} geopend.`, "");
});

elements.refreshButton.addEventListener("click", async () => {
  await refreshActiveView();
});

elements.deleteButton.addEventListener("click", async () => {
  if (!state.currentItem?.path || state.activeView === "home") {
    return;
  }

  const confirmed = window.confirm("Weet je zeker dat je dit item wilt verwijderen?");
  if (!confirmed) {
    return;
  }

  try {
    setMessage("Item verwijderen...", "");
    await api("/api/cms/delete", {
      method: "POST",
      body: JSON.stringify({
        type: state.activeView,
        path: state.currentItem.path,
        sha: state.currentItem.sha || "",
      }),
    });
    await refreshActiveView();
    setMessage("Item verwijderd.", "success");
  } catch (err) {
    setMessage(err.message, "error");
  }
});

elements.editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Opslaan...", "");

  try {
    const payload = collectFormData();
    validatePayload(payload);
    const response = await api("/api/cms/save", {
      method: "POST",
      body: JSON.stringify({
        type: state.activeView,
        path: state.currentItem?.path || "",
        sha: state.currentItem?.sha || "",
        fields: payload.fields,
        body: payload.body,
      }),
    });

    setMessage("Opgeslagen. Vergeet niet dat Cloudflare Pages daarna opnieuw moet deployen.", "success");

    if (state.activeView === "home") {
      await loadHome();
    } else {
      await refreshActiveView();
      await loadItem(response.path);
    }
  } catch (err) {
    setMessage(err.message, "error");
  }
});

loadSession().catch((err) => {
  setLoginError(err.message);
});
