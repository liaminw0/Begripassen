import { CmsApiError, cmsClient } from "./cms-client.js";
import {
  contentModels,
  createEmptyItem,
  draftStorageKey,
  fieldsForType,
  formatDutchDate,
  inputValue,
  resolveImageUrl,
  validateItem,
} from "./content-model.js";
import {
  UploadQueue,
  createRichTextEditor,
  expandAssetUrls,
  renderMarkdownPreview,
} from "./editor-tools.js";

const elements = {
  loginView: document.getElementById("login-view"),
  loginForm: document.getElementById("login-form"),
  password: document.getElementById("password-input"),
  loginError: document.getElementById("login-error"),
  workspace: document.getElementById("workspace"),
  nav: document.getElementById("main-nav"),
  navButtons: [...document.querySelectorAll("[data-route]")],
  topbarActions: document.getElementById("topbar-actions"),
  brandButton: document.getElementById("brand-button"),
  logoutButton: document.getElementById("logout-button"),
  announcement: document.getElementById("announcement"),
  overview: document.getElementById("overview-view"),
  list: document.getElementById("list-view"),
  editor: document.getElementById("editor-view"),
  listKicker: document.getElementById("list-kicker"),
  listTitle: document.getElementById("list-view-title"),
  listDescription: document.getElementById("list-description"),
  search: document.getElementById("search-input"),
  statusFilter: document.getElementById("status-filter"),
  refresh: document.getElementById("refresh-button"),
  contentList: document.getElementById("content-list"),
  loadMore: document.getElementById("load-more-button"),
  newItem: document.getElementById("new-item-button"),
  editorBack: document.getElementById("editor-back-button"),
  editorKicker: document.getElementById("editor-kicker"),
  editorTitle: document.getElementById("editor-title"),
  editorDescription: document.getElementById("editor-description"),
  contentStatus: document.getElementById("content-status"),
  editorForm: document.getElementById("editor-form"),
  editorFields: document.getElementById("editor-fields"),
  sectionTabs: document.getElementById("home-section-tabs"),
  validationSummary: document.getElementById("validation-summary"),
  saveState: document.getElementById("save-state"),
  previewButton: document.getElementById("preview-button"),
  saveDraft: document.getElementById("save-draft-button"),
  publish: document.getElementById("publish-button"),
  deleteButton: document.getElementById("delete-button"),
  recovery: document.getElementById("recovery-banner"),
  restoreDraft: document.getElementById("restore-draft-button"),
  discardDraft: document.getElementById("discard-draft-button"),
  previewDialog: document.getElementById("preview-dialog"),
  previewImageWrap: document.getElementById("preview-image-wrap"),
  previewImage: document.getElementById("preview-image"),
  previewMeta: document.getElementById("preview-meta"),
  previewTitle: document.getElementById("preview-content-title"),
  previewSummary: document.getElementById("preview-summary"),
  previewBody: document.getElementById("preview-body"),
  homePreview: document.getElementById("home-preview"),
  confirmDialog: document.getElementById("confirm-dialog"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmCancel: document.getElementById("confirm-cancel"),
  confirmAccept: document.getElementById("confirm-accept"),
};

const state = {
  authenticated: false,
  route: "overview",
  activeType: "",
  item: null,
  dirty: false,
  busy: false,
  requestController: null,
  requestSequence: 0,
  richEditor: null,
  uploadQueue: new UploadQueue(),
  autosaveTimer: null,
  currentDraftKey: "",
  pendingRecovery: null,
  activeHomeSection: "intro",
  lists: { events: [], blogs: [] },
  pagination: {
    events: { offset: 0, limit: 20, hasMore: true, loading: false },
    blogs: { offset: 0, limit: 20, hasMore: true, loading: false },
  },
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setHidden(element, hidden) {
  element.classList.toggle("hidden", hidden);
}

function announce(message, tone = "") {
  elements.announcement.textContent = message || "";
  elements.announcement.className = `announcement${tone ? ` announcement-${tone}` : ""}`;
}

function setBusy(busy, message = "") {
  state.busy = busy;
  elements.editorForm.setAttribute("aria-busy", String(busy));
  for (const button of elements.editorForm.querySelectorAll("button")) {
    if (busy) {
      button.dataset.disabledBeforeBusy = String(button.disabled);
      button.disabled = true;
    } else {
      button.disabled = button.dataset.disabledBeforeBusy === "true";
      delete button.dataset.disabledBeforeBusy;
    }
  }
  elements.logoutButton.disabled = busy;
  if (message) elements.saveState.textContent = message;
}

function showAuthenticated(authenticated) {
  state.authenticated = authenticated;
  setHidden(elements.loginView, authenticated);
  setHidden(elements.workspace, !authenticated);
  setHidden(elements.nav, !authenticated);
  setHidden(elements.topbarActions, !authenticated);
  if (!authenticated) {
    state.route = "overview";
    state.activeType = "";
    state.item = null;
    state.dirty = false;
    state.uploadQueue.clear();
    destroyRichEditor();
  }
}

function updateRouteUI(route) {
  state.route = route;
  setHidden(elements.overview, route !== "overview");
  setHidden(elements.list, route !== "list");
  setHidden(elements.editor, route !== "editor");
  for (const button of elements.navButtons) {
    const expected = route === "overview" ? "overview" : state.activeType;
    const active = button.dataset.route === expected;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}

function focusMainHeading(view) {
  const heading = view.querySelector("h1");
  if (!heading) return;
  heading.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => heading.focus());
}

function abortCurrentRequest() {
  if (state.requestController) state.requestController.abort();
  state.requestController = null;
}

function beginRequest() {
  abortCurrentRequest();
  state.requestController = new AbortController();
  state.requestSequence += 1;
  return { controller: state.requestController, sequence: state.requestSequence };
}

function destroyRichEditor() {
  if (state.richEditor) state.richEditor.destroy();
  state.richEditor = null;
}

function draftSignature(fields, body) {
  return JSON.stringify({ fields, body: String(body || "") });
}

function confirmAction({ title, message, acceptLabel = "Doorgaan", danger = false }) {
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAccept.textContent = acceptLabel;
  elements.confirmAccept.classList.toggle("button-danger", danger);
  elements.confirmAccept.classList.toggle("button-primary", !danger);
  elements.confirmDialog.showModal();

  return new Promise((resolve) => {
    const finish = (answer) => {
      elements.confirmDialog.close();
      elements.confirmAccept.removeEventListener("click", accept);
      elements.confirmCancel.removeEventListener("click", cancel);
      elements.confirmDialog.removeEventListener("cancel", cancelEvent);
      resolve(answer);
    };
    const accept = () => finish(true);
    const cancel = () => finish(false);
    const cancelEvent = (event) => { event.preventDefault(); finish(false); };
    elements.confirmAccept.addEventListener("click", accept);
    elements.confirmCancel.addEventListener("click", cancel);
    elements.confirmDialog.addEventListener("cancel", cancelEvent);
  });
}

async function allowLeavingEditor() {
  if (!state.dirty) return true;
  return confirmAction({
    title: "Niet-opgeslagen wijzigingen",
    message: "Je wijzigingen staan veilig als lokale reservekopie, maar zijn nog niet opgeslagen op de website. Wil je toch weggaan?",
    acceptLabel: "Toch weggaan",
    danger: true,
  });
}

async function goToOverview() {
  if (!(await allowLeavingEditor())) return;
  abortCurrentRequest();
  destroyRichEditor();
  state.uploadQueue.clear();
  state.item = null;
  state.dirty = false;
  state.activeType = "";
  updateRouteUI("overview");
  focusMainHeading(elements.overview);
}

function showLoadingList() {
  elements.contentList.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "content-card content-card-skeleton";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = "<span></span><span></span><span></span>";
    elements.contentList.appendChild(skeleton);
  }
}

async function openType(type) {
  if (state.route === "editor" && !(await allowLeavingEditor())) return;
  state.activeType = type;
  state.dirty = false;
  destroyRichEditor();
  state.uploadQueue.clear();

  if (type === "home") {
    await loadItem("home");
    return;
  }

  const model = contentModels[type];
  elements.listKicker.textContent = "Website-inhoud";
  elements.listTitle.textContent = model.plural;
  elements.listDescription.textContent = model.description;
  elements.newItem.textContent = model.newLabel;
  elements.search.value = "";
  elements.statusFilter.value = "all";
  updateRouteUI("list");
  showLoadingList();
  focusMainHeading(elements.list);
  await loadList(true);
}

async function loadList(reset = false) {
  const type = state.activeType;
  if (!type || type === "home") return;
  const pagination = state.pagination[type];
  if (pagination.loading || (!pagination.hasMore && !reset)) return;
  const { controller, sequence } = beginRequest();
  state.pagination[type] = { ...pagination, loading: true, ...(reset ? { offset: 0, hasMore: true } : {}) };
  elements.loadMore.disabled = true;
  if (reset) showLoadingList();

  try {
    const offset = reset ? 0 : pagination.offset;
    const payload = await cmsClient.list(type, { offset, limit: pagination.limit, signal: controller.signal });
    if (sequence !== state.requestSequence || type !== state.activeType) return;
    state.lists[type] = reset ? payload.items : [...state.lists[type], ...payload.items];
    state.pagination[type] = {
      offset: offset + payload.items.length,
      limit: payload.limit,
      hasMore: Boolean(payload.hasMore),
      loading: false,
    };
    renderList();
  } catch (err) {
    if (err?.name === "AbortError") return;
    state.pagination[type] = { ...state.pagination[type], loading: false };
    renderListError(err);
  } finally {
    elements.loadMore.disabled = false;
  }
}

function renderListError(err) {
  elements.contentList.replaceChildren();
  const panel = document.createElement("div");
  panel.className = "empty-state error-state";
  const title = document.createElement("h2");
  title.textContent = "De inhoud kon niet worden geladen";
  const message = document.createElement("p");
  message.textContent = err.message;
  const retry = document.createElement("button");
  retry.className = "button button-secondary";
  retry.type = "button";
  retry.textContent = "Opnieuw proberen";
  retry.addEventListener("click", () => loadList(true));
  panel.append(title, message, retry);
  elements.contentList.append(panel);
  handleSessionError(err);
}

function filteredItems() {
  const query = elements.search.value.trim().toLocaleLowerCase("nl-NL");
  const status = elements.statusFilter.value;
  return (state.lists[state.activeType] || []).filter((item) => {
    const matchesQuery = !query || `${item.title} ${item.summary} ${item.author}`.toLocaleLowerCase("nl-NL").includes(query);
    const matchesStatus = status === "all" || (status === "draft" ? item.draft : !item.draft);
    return matchesQuery && matchesStatus;
  });
}

function renderList() {
  elements.contentList.replaceChildren();
  const items = filteredItems();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("h2");
    title.textContent = elements.search.value || elements.statusFilter.value !== "all" ? "Geen resultaten" : `Nog geen ${contentModels[state.activeType].plural.toLowerCase()}`;
    const copy = document.createElement("p");
    copy.textContent = elements.search.value || elements.statusFilter.value !== "all" ? "Pas je zoekopdracht of filter aan." : `Maak het eerste ${contentModels[state.activeType].singular} aan.`;
    empty.append(title, copy);
    elements.contentList.append(empty);
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "content-card";
    const body = document.createElement("div");
    body.className = "content-card-body";
    const meta = document.createElement("div");
    meta.className = "content-card-meta";
    const status = document.createElement("span");
    status.className = `status-badge ${item.draft ? "status-draft" : "status-published"}`;
    status.textContent = item.draft ? "Concept" : "Gepubliceerd";
    const date = document.createElement("span");
    date.textContent = formatDutchDate(item.date, state.activeType === "events");
    meta.append(status, date);
    const title = document.createElement("h2");
    title.textContent = item.title;
    const summary = document.createElement("p");
    summary.textContent = item.summary || "Geen samenvatting ingevuld.";
    body.append(meta, title, summary);

    const actions = document.createElement("div");
    actions.className = "content-card-actions";
    if (!item.draft && item.publicUrl) {
      const view = document.createElement("a");
      view.className = "button button-quiet";
      view.href = item.publicUrl;
      view.target = "_blank";
      view.rel = "noopener";
      view.textContent = "Bekijken";
      view.setAttribute("aria-label", `${item.title} bekijken op de website`);
      actions.append(view);
    }
    const edit = document.createElement("button");
    edit.className = "button button-secondary";
    edit.type = "button";
    edit.textContent = "Bewerken";
    edit.setAttribute("aria-label", `${item.title} bewerken`);
    edit.addEventListener("click", () => loadItem(state.activeType, item.path));
    actions.append(edit);
    card.append(body, actions);
    elements.contentList.append(card);
  }

  setHidden(elements.loadMore, !state.pagination[state.activeType]?.hasMore);
}

async function loadItem(type, path = "") {
  const { controller, sequence } = beginRequest();
  state.activeType = type;
  updateRouteUI("editor");
  elements.editorFields.innerHTML = '<div class="editor-loading"><span></span><p>Inhoud laden…</p></div>';
  elements.editorTitle.textContent = type === "home" ? "Homepagina laden…" : "Inhoud laden…";
  focusMainHeading(elements.editor);
  try {
    const payload = await cmsClient.item(type, path, controller.signal);
    if (sequence !== state.requestSequence || type !== state.activeType) return;
    renderEditor(payload.item);
  } catch (err) {
    if (err?.name === "AbortError") return;
    renderEditorLoadError(err, () => loadItem(type, path));
  }
}

function renderEditorLoadError(err, retry) {
  elements.editorFields.replaceChildren();
  const panel = document.createElement("div");
  panel.className = "empty-state error-state";
  panel.innerHTML = "<h2>De inhoud kon niet worden geopend</h2>";
  const copy = document.createElement("p");
  copy.textContent = err.message;
  const button = document.createElement("button");
  button.className = "button button-secondary";
  button.type = "button";
  button.textContent = "Opnieuw proberen";
  button.addEventListener("click", retry);
  panel.append(copy, button);
  elements.editorFields.append(panel);
  handleSessionError(err);
}

function createHelp(field, inputId) {
  if (!field.help) return null;
  const help = document.createElement("p");
  help.className = "field-help";
  help.id = `${inputId}-help`;
  help.textContent = field.help;
  return help;
}

function createError(fieldName, inputId) {
  const error = document.createElement("p");
  error.className = "field-error";
  error.id = `${inputId}-error`;
  error.dataset.errorFor = fieldName;
  error.setAttribute("aria-live", "polite");
  return error;
}

function describedBy(field, inputId) {
  return [field.help ? `${inputId}-help` : "", `${inputId}-error`].filter(Boolean).join(" ");
}

function createStandardField(field, value) {
  const wrapper = document.createElement("div");
  wrapper.className = `field${field.layout === "half" ? " field-half" : ""}`;
  wrapper.dataset.fieldWrapper = field.name;
  if (field.condition) wrapper.dataset.condition = field.condition;
  const inputId = `field-${field.name}`;
  const label = document.createElement("label");
  label.htmlFor = inputId;
  label.textContent = field.label;
  if (field.required) {
    const required = document.createElement("span");
    required.className = "required-mark";
    required.textContent = " verplicht";
    label.append(required);
  }

  let input;
  if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = field.rows || 5;
  } else {
    input = document.createElement("input");
    input.type = field.type;
  }
  input.id = inputId;
  input.name = field.name;
  input.dataset.contentInput = "true";
  input.value = inputValue(field, value);
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.required) input.required = true;
  if (field.maxLength) input.maxLength = field.maxLength;
  input.setAttribute("aria-describedby", describedBy(field, inputId));
  wrapper.append(label, input);
  const help = createHelp(field, inputId);
  if (help) wrapper.append(help);
  if (field.maxLength) {
    const count = document.createElement("span");
    count.className = "character-count";
    count.dataset.countFor = field.name;
    count.textContent = `${input.value.length}/${field.maxLength}`;
    wrapper.append(count);
  }
  wrapper.append(createError(field.name, inputId));
  return wrapper;
}

function createCheckboxField(field, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "field toggle-field";
  wrapper.dataset.fieldWrapper = field.name;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = `field-${field.name}`;
  input.name = field.name;
  input.checked = Boolean(value);
  input.dataset.contentInput = "true";
  const label = document.createElement("label");
  label.htmlFor = input.id;
  const copy = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = field.label;
  const small = document.createElement("small");
  small.textContent = "Je kunt dit later altijd weer uitzetten.";
  copy.append(strong, small);
  label.append(input, copy);
  wrapper.append(label, createError(field.name, input.id));
  return wrapper;
}

function imagePreviewSource(value, itemPath) {
  const queued = state.uploadQueue.get(value);
  return queued?.objectUrl || resolveImageUrl(value, itemPath);
}

function createImageField(field, value, item) {
  const wrapper = document.createElement("div");
  wrapper.className = "field image-field";
  wrapper.dataset.fieldWrapper = field.name;
  const inputId = `field-${field.name}`;
  const heading = document.createElement("div");
  heading.className = "image-field-heading";
  const label = document.createElement("span");
  label.className = "field-label";
  label.textContent = field.label;
  const help = createHelp(field, inputId);
  heading.append(label);
  if (help) heading.append(help);

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.id = inputId;
  hidden.name = field.name;
  hidden.value = value || "";
  hidden.dataset.contentInput = "true";

  const picker = document.createElement("div");
  picker.className = "image-picker";
  const preview = document.createElement("div");
  preview.className = "image-picker-preview";
  const image = document.createElement("img");
  image.alt = "Voorbeeld van de gekozen afbeelding";
  const empty = document.createElement("div");
  empty.className = "image-picker-empty";
  empty.innerHTML = "<strong>Nog geen afbeelding</strong><span>JPG, PNG of WebP</span>";
  preview.append(image, empty);
  const source = imagePreviewSource(value, item.path);
  image.src = source || "";
  preview.classList.toggle("is-empty", !source);

  const controls = document.createElement("div");
  controls.className = "image-picker-controls";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/jpeg,image/png,image/webp";
  fileInput.className = "visually-hidden";
  fileInput.id = `${inputId}-file`;
  const choose = document.createElement("button");
  choose.type = "button";
  choose.className = "button button-secondary";
  choose.textContent = source ? "Afbeelding vervangen" : "Afbeelding kiezen";
  choose.addEventListener("click", () => fileInput.click());
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "button button-quiet";
  remove.textContent = "Afbeelding verwijderen";
  remove.disabled = !source;
  controls.append(fileInput, choose, remove);
  picker.append(preview, controls);

  const altWrapper = document.createElement("div");
  altWrapper.className = "field image-alt-field";
  const altId = `field-${field.altName}`;
  const altLabel = document.createElement("label");
  altLabel.htmlFor = altId;
  altLabel.textContent = "Beschrijving voor bezoekers die de afbeelding niet zien";
  const altInput = document.createElement("input");
  altInput.type = "text";
  altInput.id = altId;
  altInput.name = field.altName;
  altInput.maxLength = 180;
  altInput.value = item.fields[field.altName] || "";
  altInput.placeholder = "Bijvoorbeeld: jongeren in gesprek tijdens een bijeenkomst";
  altInput.dataset.contentInput = "true";
  altInput.setAttribute("aria-describedby", `${altId}-help ${altId}-error`);
  const altHelp = document.createElement("p");
  altHelp.className = "field-help";
  altHelp.id = `${altId}-help`;
  altHelp.textContent = "Kort en concreet is genoeg. Laat dit leeg als er geen afbeelding is.";
  altWrapper.append(altLabel, altInput, altHelp, createError(field.altName, altId));

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    choose.disabled = true;
    choose.textContent = "Afbeelding voorbereiden…";
    try {
      const oldToken = hidden.value;
      const oldQueued = state.uploadQueue.get(oldToken);
      const previousValue = oldQueued ? oldQueued.previousValue : hidden.value;
      const staged = await state.uploadQueue.stage(file, { fieldName: field.name, previousValue });
      if (oldQueued) state.uploadQueue.remove(oldToken);
      hidden.value = staged.token;
      image.src = staged.objectUrl;
      preview.classList.remove("is-empty");
      remove.disabled = false;
      choose.textContent = "Afbeelding vervangen";
      announce(`Afbeelding klaar (${staged.width} × ${staged.height} pixels).`, "success");
      markDirty();
    } catch (err) {
      announce(err.message, "error");
      choose.textContent = source ? "Afbeelding vervangen" : "Afbeelding kiezen";
    } finally {
      choose.disabled = false;
    }
  });

  remove.addEventListener("click", () => {
    if (state.uploadQueue.get(hidden.value)) state.uploadQueue.remove(hidden.value);
    hidden.value = "";
    image.removeAttribute("src");
    preview.classList.add("is-empty");
    remove.disabled = true;
    choose.textContent = "Afbeelding kiezen";
    markDirty();
  });

  wrapper.append(heading, hidden, picker, altWrapper, createError(field.name, inputId));
  return wrapper;
}

function createRichTextField(field) {
  const wrapper = document.createElement("div");
  wrapper.className = "field rich-text-field";
  wrapper.dataset.fieldWrapper = field.name;
  const label = document.createElement("span");
  label.className = "field-label";
  label.id = "body-editor-label";
  label.textContent = field.label;
  const help = document.createElement("p");
  help.className = "field-help";
  help.textContent = "Gebruik koppen, vet, cursief, links en lijsten. Afbeeldingen kun je via de werkbalk toevoegen.";
  const host = document.createElement("div");
  host.className = "rich-editor-host";
  host.setAttribute("aria-labelledby", label.id);
  wrapper.append(label, help, host, createError("body", "body-editor"));
  return { wrapper, host };
}

function createSection(section, item, type) {
  const container = document.createElement("section");
  container.className = "form-section";
  container.dataset.section = section.id;
  const header = document.createElement("header");
  header.className = "form-section-heading";
  const step = document.createElement("span");
  step.textContent = section.label;
  const title = document.createElement("h2");
  title.textContent = section.title;
  const copy = document.createElement("p");
  copy.textContent = section.description;
  header.append(step, title, copy);
  const grid = document.createElement("div");
  grid.className = "field-grid";
  let richHost = null;

  for (const field of section.fields) {
    const value = field.name === "body" ? item.body : item.fields[field.name];
    let fieldNode;
    if (field.type === "checkbox") fieldNode = createCheckboxField(field, value);
    else if (field.type === "image") fieldNode = createImageField(field, value, item);
    else if (field.type === "richtext") {
      const rich = createRichTextField(field);
      fieldNode = rich.wrapper;
      richHost = rich.host;
    } else fieldNode = createStandardField(field, value);
    grid.append(fieldNode);
  }
  container.append(header, grid);
  return { container, richHost };
}

function renderHomeTabs(model) {
  elements.sectionTabs.replaceChildren();
  setHidden(elements.sectionTabs, false);
  for (const section of model.sections) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = section.label;
    button.dataset.homeSection = section.id;
    button.classList.toggle("is-active", section.id === state.activeHomeSection);
    if (section.id === state.activeHomeSection) button.setAttribute("aria-current", "step");
    button.addEventListener("click", () => selectHomeSection(section.id));
    elements.sectionTabs.append(button);
  }
}

function selectHomeSection(sectionId) {
  state.activeHomeSection = sectionId;
  for (const section of elements.editorFields.querySelectorAll("[data-section]")) {
    setHidden(section, section.dataset.section !== sectionId);
  }
  for (const button of elements.sectionTabs.querySelectorAll("button")) {
    const active = button.dataset.homeSection === sectionId;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }
  const visible = elements.editorFields.querySelector(`[data-section="${CSS.escape(sectionId)}"]`);
  if (visible) requestAnimationFrame(() => visible.querySelector("input, textarea, button")?.focus());
}

function renderEditor(item, { skipRecovery = false } = {}) {
  destroyRichEditor();
  state.uploadQueue.clear();
  state.item = deepClone(item);
  state.dirty = false;
  state.pendingRecovery = null;
  state.activeHomeSection = "intro";
  const type = item.type;
  const model = contentModels[type];
  elements.editorKicker.textContent = item.path ? "Bewerken" : `Nieuw ${model.singular}`;
  elements.editorTitle.textContent = type === "home" ? "Homepagina bewerken" : item.path ? item.fields.title : model.newLabel;
  elements.editorDescription.textContent = model.description;
  elements.publish.textContent = model.publishLabel;
  setHidden(elements.saveDraft, type === "home");
  setHidden(elements.deleteButton, type === "home" || !item.path);
  elements.contentStatus.textContent = type === "home" ? "Live" : item.fields.draft ? "Concept" : "Gepubliceerd";
  elements.contentStatus.className = `status-pill ${item.fields.draft ? "status-draft" : "status-published"}`;
  elements.saveState.textContent = "Nog geen wijzigingen";
  clearValidation();
  setHidden(elements.recovery, true);
  elements.editorFields.replaceChildren();

  let richHost = null;
  for (const section of model.sections) {
    const rendered = createSection(section, item, type);
    elements.editorFields.append(rendered.container);
    if (rendered.richHost) richHost = rendered.richHost;
  }
  if (type === "home") {
    renderHomeTabs(model);
    selectHomeSection(state.activeHomeSection);
  } else {
    setHidden(elements.sectionTabs, true);
  }

  if (richHost) {
    state.richEditor = createRichTextEditor({
      host: richHost,
      initialValue: item.body,
      itemPath: item.path,
      uploadQueue: state.uploadQueue,
      onChange: markDirty,
      onMessage: announce,
    });
  }
  updateConditions();
  updateCharacterCounts();
  state.currentDraftKey = draftStorageKey(type, item.path);
  if (!skipRecovery) findRecoveryDraft();
  updateRouteUI("editor");
  focusMainHeading(elements.editor);
}

function collectForm() {
  const fields = { ...(state.item?.fields || {}) };
  for (const input of elements.editorForm.querySelectorAll("[data-content-input]")) {
    fields[input.name] = input.type === "checkbox" ? input.checked : input.value.trim();
  }
  const body = state.richEditor ? state.richEditor.getMarkdown().trim() : state.item?.body || "";
  return { fields, body };
}

function updateConditions() {
  for (const wrapper of elements.editorFields.querySelectorAll("[data-condition]")) {
    const controller = elements.editorFields.querySelector(`[name="${CSS.escape(wrapper.dataset.condition)}"]`);
    const visible = Boolean(controller?.checked);
    setHidden(wrapper, !visible);
    for (const input of wrapper.querySelectorAll("input, textarea, select")) input.disabled = !visible;
  }
}

function updateCharacterCounts() {
  for (const count of elements.editorFields.querySelectorAll("[data-count-for]")) {
    const input = elements.editorFields.querySelector(`[name="${CSS.escape(count.dataset.countFor)}"]`);
    if (input) count.textContent = `${input.value.length}/${input.maxLength}`;
  }
}

function markDirty() {
  if (!state.item || state.busy) return;
  state.dirty = true;
  elements.saveState.textContent = "Wijzigingen nog niet opgeslagen";
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(saveLocalDraft, 900);
}

function saveLocalDraft() {
  if (!state.dirty || !state.item) return;
  try {
    const collected = collectForm();
    const safe = state.uploadQueue.safeLocalCopy(collected.fields, collected.body);
    localStorage.setItem(state.currentDraftKey, JSON.stringify({
      savedAt: Date.now(),
      fields: safe.fields,
      body: safe.body,
      omittedImages: safe.omittedImages,
    }));
    const time = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    elements.saveState.textContent = safe.omittedImages
      ? `Tekst lokaal bewaard om ${time}; nieuwe afbeeldingen worden bewaard na opslaan`
      : `Lokale reservekopie bewaard om ${time}`;
  } catch {
    elements.saveState.textContent = "Lokale reservekopie kon niet worden bewaard";
  }
}

function findRecoveryDraft() {
  try {
    const raw = localStorage.getItem(state.currentDraftKey);
    if (!raw) return;
    const recovery = JSON.parse(raw);
    if (!recovery?.fields || draftSignature(recovery.fields, recovery.body) === draftSignature(state.item.fields, state.item.body)) return;
    state.pendingRecovery = recovery;
    setHidden(elements.recovery, false);
  } catch {
    localStorage.removeItem(state.currentDraftKey);
  }
}

function clearLocalDraft() {
  if (state.currentDraftKey) localStorage.removeItem(state.currentDraftKey);
  state.pendingRecovery = null;
  setHidden(elements.recovery, true);
}

function clearValidation() {
  setHidden(elements.validationSummary, true);
  elements.validationSummary.querySelector("ul").replaceChildren();
  for (const wrapper of elements.editorFields.querySelectorAll(".field-has-error")) wrapper.classList.remove("field-has-error");
  for (const error of elements.editorFields.querySelectorAll("[data-error-for]")) error.textContent = "";
  for (const input of elements.editorFields.querySelectorAll("[aria-invalid]")) input.removeAttribute("aria-invalid");
}

function fieldLabel(name) {
  if (name === "body") return "Inhoud";
  if (name.endsWith("_alt")) return "Beschrijving van de afbeelding";
  return fieldsForType(state.activeType).find((field) => field.name === name)?.label || "Veld";
}

function sectionForField(name) {
  return contentModels[state.activeType].sections.find((section) => section.fields.some((field) => field.name === name || field.altName === name));
}

function showValidation(errors) {
  clearValidation();
  const list = elements.validationSummary.querySelector("ul");
  for (const [name, message] of Object.entries(errors)) {
    const error = elements.editorFields.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    const input = elements.editorFields.querySelector(`[name="${CSS.escape(name)}"]`);
    const wrapper = error?.closest(".field") || input?.closest(".field");
    if (error) error.textContent = message;
    if (wrapper) wrapper.classList.add("field-has-error");
    if (input) input.setAttribute("aria-invalid", "true");
    const item = document.createElement("li");
    item.textContent = `${fieldLabel(name)}: ${message}`;
    list.append(item);
  }
  setHidden(elements.validationSummary, false);
  const firstField = Object.keys(errors)[0];
  if (state.activeType === "home") {
    const section = sectionForField(firstField);
    if (section) selectHomeSection(section.id);
  }
  elements.validationSummary.focus();
}

async function saveItem(intent) {
  if (state.busy || !state.item) return;
  clearValidation();
  const collected = collectForm();
  if (state.activeType !== "home") collected.fields.draft = intent === "draft";
  const errors = validateItem(state.activeType, collected.fields, collected.body);
  if (Object.keys(errors).length) {
    showValidation(errors);
    announce("Controleer de gemarkeerde velden.", "error");
    return;
  }

  setBusy(true, intent === "draft" ? "Concept opslaan…" : "Publiceren…");
  try {
    const prepared = await state.uploadQueue.preparePayload(collected.fields, collected.body);
    const response = await cmsClient.save({
      type: state.activeType,
      path: state.item.path,
      sha: state.item.sha,
      fields: prepared.fields,
      body: prepared.body,
      uploads: prepared.uploads,
    });
    clearLocalDraft();
    const savedItem = {
      type: state.activeType,
      path: response.path,
      publicUrl: response.publicUrl,
      sha: response.sha,
      fields: response.fields,
      body: response.body,
    };
    updateCachedList(savedItem);
    applySavedItem(savedItem);
    elements.saveState.textContent = intent === "draft" ? "Concept opgeslagen" : "Gepubliceerd; de website wordt bijgewerkt";
    announce(intent === "draft" ? "Concept veilig opgeslagen." : "Gepubliceerd. De website wordt nu bijgewerkt.", "success");
  } catch (err) {
    if (err instanceof CmsApiError && err.details?.fields) showValidation(err.details.fields);
    announce(err.message, "error");
    elements.saveState.textContent = "Opslaan mislukt; je wijzigingen staan nog in de editor";
    handleSessionError(err);
  } finally {
    setBusy(false);
  }
}

function applySavedItem(item) {
  state.item = deepClone(item);
  for (const input of elements.editorForm.querySelectorAll("[data-content-input]")) {
    if (!(input.name in item.fields)) continue;
    if (input.type === "checkbox") input.checked = Boolean(item.fields[input.name]);
    else input.value = inputValue({ type: input.type }, item.fields[input.name]);
  }
  if (state.richEditor) state.richEditor.setMarkdown(item.body);

  for (const field of fieldsForType(item.type).filter((candidate) => candidate.type === "image")) {
    const wrapper = elements.editorFields.querySelector(`[data-field-wrapper="${CSS.escape(field.name)}"]`);
    const preview = wrapper?.querySelector(".image-picker-preview");
    const image = preview?.querySelector("img");
    const remove = [...(wrapper?.querySelectorAll("button") || [])].find((button) => button.textContent.includes("verwijderen"));
    const choose = [...(wrapper?.querySelectorAll("button") || [])].find((button) => button.textContent.includes("Afbeelding"));
    const source = resolveImageUrl(item.fields[field.name], item.path);
    if (image) image.src = source || "";
    preview?.classList.toggle("is-empty", !source);
    if (remove) remove.disabled = !source;
    if (choose) choose.textContent = source ? "Afbeelding vervangen" : "Afbeelding kiezen";
  }
  state.uploadQueue.clear();
  state.currentDraftKey = draftStorageKey(item.type, item.path);
  state.pendingRecovery = null;
  state.dirty = false;
  elements.editorKicker.textContent = "Bewerken";
  elements.editorTitle.textContent = item.type === "home" ? "Homepagina bewerken" : item.fields.title;
  elements.contentStatus.textContent = item.type === "home" ? "Live" : item.fields.draft ? "Concept" : "Gepubliceerd";
  elements.contentStatus.className = `status-pill ${item.fields.draft ? "status-draft" : "status-published"}`;
  setHidden(elements.deleteButton, item.type === "home");
  updateConditions();
  updateCharacterCounts();
  clearValidation();
}

function updateCachedList(item) {
  if (item.type === "home") return;
  const summary = item.fields.summary || item.body.split("\n").find(Boolean) || "";
  const listItem = {
    path: item.path,
    publicUrl: item.publicUrl,
    title: item.fields.title,
    date: item.fields.date,
    draft: Boolean(item.fields.draft),
    author: item.fields.author || item.fields.organiser || "",
    summary,
    type: item.type,
  };
  const items = [...state.lists[item.type]];
  const index = items.findIndex((candidate) => candidate.path === item.path);
  if (index >= 0) items[index] = listItem;
  else items.unshift(listItem);
  state.lists[item.type] = items.sort((left, right) => String(right.date).localeCompare(String(left.date)));
}

function currentCoverSource(fields) {
  const name = state.activeType === "home" ? "about_image" : "image";
  return imagePreviewSource(fields[name], state.item?.path || "");
}

function showPreview() {
  if (!state.item) return;
  const { fields, body } = collectForm();
  const type = state.activeType;
  const isHome = type === "home";
  setHidden(elements.homePreview, !isHome);
  setHidden(elements.previewBody, isHome);
  setHidden(elements.previewMeta, isHome);
  setHidden(elements.previewSummary, isHome);
  elements.previewTitle.textContent = isHome ? "Homepagina" : fields.title || "Titel van de inhoud";

  const cover = currentCoverSource(fields);
  elements.previewImage.src = cover || "";
  elements.previewImage.alt = isHome ? fields.about_image_alt || "" : fields.image_alt || "";
  setHidden(elements.previewImageWrap, !cover);

  if (isHome) {
    elements.homePreview.replaceChildren();
    const blocks = [
      ["Introductie", fields.heading],
      ["Over ons", fields.about],
      ["Nieuwsbrief", fields.newsletter],
      ["Steun ons", fields.support],
      ["Contact", fields.contact],
    ];
    for (const [title, copy] of blocks) {
      const section = document.createElement("section");
      const heading = document.createElement("h2");
      heading.textContent = title;
      const paragraph = document.createElement("p");
      paragraph.textContent = copy || "Nog geen tekst ingevuld.";
      section.append(heading, paragraph);
      elements.homePreview.append(section);
    }
  } else {
    elements.previewMeta.textContent = type === "events"
      ? [formatDutchDate(fields.date, true), fields.location, fields.organiser].filter(Boolean).join(" · ")
      : [formatDutchDate(fields.date), fields.author].filter(Boolean).join(" · ");
    elements.previewSummary.textContent = fields.summary || "";
    renderMarkdownPreview(elements.previewBody, expandAssetUrls(body, state.item.path));
  }
  elements.previewDialog.showModal();
}

async function deleteItem() {
  if (!state.item?.path || state.activeType === "home" || state.busy) return;
  const confirmed = await confirmAction({
    title: `${contentModels[state.activeType].singular === "blog" ? "Blog" : "Evenement"} verwijderen?`,
    message: `“${state.item.fields.title}” en de bijbehorende afbeeldingen worden definitief verwijderd. Dit kan niet via het beheer worden teruggedraaid.`,
    acceptLabel: "Definitief verwijderen",
    danger: true,
  });
  if (!confirmed) return;

  setBusy(true, "Verwijderen…");
  try {
    await cmsClient.delete({ type: state.activeType, path: state.item.path, sha: state.item.sha });
    clearLocalDraft();
    state.lists[state.activeType] = state.lists[state.activeType].filter((item) => item.path !== state.item.path);
    state.dirty = false;
    destroyRichEditor();
    state.uploadQueue.clear();
    updateRouteUI("list");
    renderList();
    focusMainHeading(elements.list);
    announce("De inhoud is verwijderd. De website wordt nu bijgewerkt.", "success");
  } catch (err) {
    announce(err.message, "error");
    handleSessionError(err);
  } finally {
    setBusy(false);
  }
}

function handleSessionError(err) {
  if (!(err instanceof CmsApiError) || err.status !== 401) return;
  cmsClient.setSession(null);
  showAuthenticated(false);
  elements.loginError.textContent = "Je sessie is verlopen. Log opnieuw in om verder te gaan.";
  elements.password.focus();
}

async function boot() {
  try {
    const session = await cmsClient.session();
    cmsClient.setSession(session);
    showAuthenticated(session.authenticated);
    if (session.authenticated) {
      updateRouteUI("overview");
      focusMainHeading(elements.overview);
    } else {
      elements.password.focus();
    }
  } catch (err) {
    showAuthenticated(false);
    elements.loginError.textContent = err.message;
  }
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginError.textContent = "";
  const submit = elements.loginForm.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Inloggen…";
  try {
    await cmsClient.login(elements.password.value);
    elements.password.value = "";
    const session = await cmsClient.session();
    cmsClient.setSession(session);
    showAuthenticated(true);
    updateRouteUI("overview");
    focusMainHeading(elements.overview);
  } catch (err) {
    elements.loginError.textContent = err.message;
    elements.password.select();
  } finally {
    submit.disabled = false;
    submit.textContent = "Inloggen";
  }
});

elements.logoutButton.addEventListener("click", async () => {
  if (!(await allowLeavingEditor())) return;
  try { await cmsClient.logout(); }
  catch (err) { if (err.status !== 401) announce(err.message, "error"); }
  cmsClient.setSession(null);
  showAuthenticated(false);
  elements.password.focus();
});

elements.brandButton.addEventListener("click", () => {
  if (state.authenticated) goToOverview();
  else elements.password.focus();
});

for (const button of elements.navButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.route === "overview") goToOverview();
    else openType(button.dataset.route);
  });
}
for (const button of document.querySelectorAll("[data-open-type]")) {
  button.addEventListener("click", () => openType(button.dataset.openType));
}
for (const button of document.querySelectorAll(".back-to-overview")) button.addEventListener("click", goToOverview);

elements.editorBack.addEventListener("click", async () => {
  if (!(await allowLeavingEditor())) return;
  destroyRichEditor();
  state.uploadQueue.clear();
  state.dirty = false;
  if (state.activeType === "home") await goToOverview();
  else {
    updateRouteUI("list");
    renderList();
    focusMainHeading(elements.list);
  }
});

elements.newItem.addEventListener("click", () => renderEditor(createEmptyItem(state.activeType)));
elements.refresh.addEventListener("click", () => loadList(true));
elements.loadMore.addEventListener("click", () => loadList(false));
elements.search.addEventListener("input", renderList);
elements.statusFilter.addEventListener("change", renderList);

elements.editorFields.addEventListener("input", (event) => {
  if (!event.target.matches("[data-content-input]")) return;
  updateConditions();
  updateCharacterCounts();
  const error = elements.editorFields.querySelector(`[data-error-for="${CSS.escape(event.target.name)}"]`);
  if (error) error.textContent = "";
  event.target.removeAttribute("aria-invalid");
  event.target.closest(".field")?.classList.remove("field-has-error");
  markDirty();
});
elements.editorFields.addEventListener("change", (event) => {
  if (event.target.matches("[data-content-input]")) {
    updateConditions();
    markDirty();
  }
});

elements.editorForm.addEventListener("submit", (event) => { event.preventDefault(); saveItem("publish"); });
elements.saveDraft.addEventListener("click", () => saveItem("draft"));
elements.previewButton.addEventListener("click", showPreview);
elements.deleteButton.addEventListener("click", deleteItem);

elements.restoreDraft.addEventListener("click", () => {
  if (!state.pendingRecovery) return;
  const restored = {
    ...state.item,
    fields: { ...state.item.fields, ...state.pendingRecovery.fields },
    body: state.pendingRecovery.body || "",
  };
  const omittedImages = state.pendingRecovery.omittedImages;
  renderEditor(restored, { skipRecovery: true });
  state.dirty = true;
  elements.saveState.textContent = "Lokale versie hersteld; nog niet opgeslagen";
  announce(omittedImages ? "Lokale tekst hersteld. Kies niet-opgeslagen afbeeldingen opnieuw." : "Lokale versie hersteld.", "success");
});
elements.discardDraft.addEventListener("click", clearLocalDraft);

for (const button of document.querySelectorAll("[data-close-dialog]")) {
  button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog)?.close());
}
elements.previewDialog.addEventListener("click", (event) => {
  if (event.target === elements.previewDialog) elements.previewDialog.close();
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s" || state.route !== "editor") return;
  event.preventDefault();
  saveItem(state.activeType === "home" ? "publish" : "draft");
});

boot();
