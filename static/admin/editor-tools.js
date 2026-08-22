import { resolveImageUrl } from "./content-model.js";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 6 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function publicBundleBase(itemPath = "") {
  if (!itemPath.endsWith("/index.md")) return "";
  return `/${itemPath.replace(/^content\//, "").replace(/index\.md$/, "")}`;
}

export function expandAssetUrls(markdown, itemPath = "") {
  const base = publicBundleBase(itemPath);
  if (!base) return String(markdown || "");
  return String(markdown || "").replace(/(!\[[^\]]*\]\()([^)\s]+)(\))/g, (match, before, url, after) => {
    return `${before}${resolveImageUrl(url, itemPath)}${after}`;
  });
}

export function collapseAssetUrls(markdown, itemPath = "") {
  const base = publicBundleBase(itemPath);
  if (!base) return String(markdown || "");
  const originBase = `${window.location.origin}${base}`;
  const basePattern = new RegExp(`^(?:${escapeRegExp(originBase)}|${escapeRegExp(base)})`);
  return String(markdown || "").replace(/(!\[[^\]]*\]\()([^)\s]+)(\))/g, (match, before, url, after) => {
    return `${before}${url.replace(basePattern, "")}${after}`;
  });
}

function safeEditorUrl(value, allowRelative = true) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (allowRelative && (raw.startsWith("/") || raw.startsWith("#") || raw.startsWith("blob:"))) return raw;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function inlineMarkdown(value) {
  let output = escapeHtml(value);
  output = output.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, (match, alt, source) => {
    const safeSource = safeEditorUrl(source);
    return safeSource ? `<img src="${escapeHtml(safeSource)}" alt="${alt}" />` : "";
  });
  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, (match, text, target) => {
    const safeTarget = safeEditorUrl(target);
    return safeTarget ? `<a href="${escapeHtml(safeTarget)}">${text}</a>` : text;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  output = output.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  output = output.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  return output;
}

export function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(`<${list.tag}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(4, Math.max(2, heading[1].length));
      blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const tag = unordered ? "ul" : "ol";
      if (list?.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((unordered || ordered)[1]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks.join("") || "<p><br></p>";
}

function inlineNodeToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  const children = [...node.childNodes].map(inlineNodeToMarkdown).join("");
  if (tag === "strong" || tag === "b") return children ? `**${children}**` : "";
  if (tag === "em" || tag === "i") return children ? `*${children}*` : "";
  if (tag === "a") {
    const href = safeEditorUrl(node.getAttribute("href"));
    return href ? `[${children || href}](${href})` : children;
  }
  if (tag === "img") {
    const source = safeEditorUrl(node.getAttribute("src"));
    return source ? `![${String(node.getAttribute("alt") || "").replace(/[\[\]]/g, "")}](${source})` : "";
  }
  if (tag === "br") return "\n";
  return children;
}

function listToMarkdown(list) {
  const ordered = list.tagName.toLowerCase() === "ol";
  return [...list.children]
    .filter((item) => item.tagName.toLowerCase() === "li")
    .map((item, index) => `${ordered ? `${index + 1}.` : "-"} ${[...item.childNodes].map(inlineNodeToMarkdown).join("").trim()}`)
    .join("\n");
}

export function editorHtmlToMarkdown(root) {
  const blocks = [];
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) blocks.push(node.textContent.trim());
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const level = Math.min(4, Math.max(2, Number(tag.slice(1))));
      blocks.push(`${"#".repeat(level)} ${[...node.childNodes].map(inlineNodeToMarkdown).join("").trim()}`);
    } else if (tag === "ul" || tag === "ol") {
      blocks.push(listToMarkdown(node));
    } else if (tag === "p" || tag === "div") {
      const content = [...node.childNodes].map(inlineNodeToMarkdown).join("").trim();
      if (content) blocks.push(content);
    } else if (tag === "img") {
      blocks.push(inlineNodeToMarkdown(node));
    } else {
      const content = inlineNodeToMarkdown(node).trim();
      if (content) blocks.push(content);
    }
  }
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function loadBitmap(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("De afbeelding kon niet worden geopend.")); };
    image.src = objectUrl;
  });
}

export async function prepareImage(file) {
  if (!file || !ALLOWED_TYPES.has(file.type)) throw new Error("Kies een JPG-, PNG- of WebP-afbeelding.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("De gekozen afbeelding is groter dan 12 MB.");
  const bitmap = await loadBitmap(file);
  const sourceWidth = bitmap.naturalWidth || bitmap.width;
  const sourceHeight = bitmap.naturalHeight || bitmap.height;
  if (!sourceWidth || !sourceHeight) throw new Error("De afbeelding heeft geen geldige afmetingen.");
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("De browser kon de afbeelding niet verwerken.");
  context.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === "function") bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob) throw new Error("De afbeelding kon niet worden verkleind.");
  if (blob.size > MAX_OUTPUT_BYTES) throw new Error("De afbeelding blijft na verkleinen groter dan 6 MB. Kies een kleiner bestand.");
  const filename = `${file.name.replace(/\.[^/.]+$/, "") || "afbeelding"}.webp`;
  return { file: new File([blob], filename, { type: "image/webp" }), width, height };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",").pop());
    reader.onerror = () => reject(new Error("De afbeelding kon niet worden voorbereid."));
    reader.readAsDataURL(file);
  });
}

export class UploadQueue {
  constructor() {
    this.items = new Map();
  }

  async stage(file, { fieldName = "", previousValue = "" } = {}) {
    const prepared = await prepareImage(file);
    const token = `__CMS_UPLOAD_${crypto.randomUUID()}__`;
    const objectUrl = URL.createObjectURL(prepared.file);
    this.items.set(token, { token, objectUrl, fieldName, previousValue, ...prepared });
    return this.items.get(token);
  }

  remove(token) {
    const item = this.items.get(token);
    if (item?.objectUrl) URL.revokeObjectURL(item.objectUrl);
    this.items.delete(token);
  }

  clear() {
    for (const token of [...this.items.keys()]) this.remove(token);
  }

  get(token) {
    return this.items.get(token);
  }

  async preparePayload(fields, markdown) {
    const nextFields = { ...fields };
    let nextBody = String(markdown || "");
    const uploads = [];
    for (const item of this.items.values()) {
      nextBody = nextBody.split(item.objectUrl).join(item.token);
      const referenced = Object.values(nextFields).includes(item.token) || nextBody.includes(item.token);
      if (!referenced) continue;
      uploads.push({ token: item.token, filename: item.file.name, mimeType: item.file.type, base64: await fileToBase64(item.file) });
    }
    return { fields: nextFields, body: nextBody, uploads };
  }

  safeLocalCopy(fields, markdown) {
    const nextFields = { ...fields };
    let nextBody = String(markdown || "");
    for (const item of this.items.values()) {
      if (item.fieldName && nextFields[item.fieldName] === item.token) nextFields[item.fieldName] = item.previousValue;
      nextBody = nextBody.split(item.objectUrl).join("");
    }
    return { fields: nextFields, body: nextBody.trim(), omittedImages: this.items.size > 0 };
  }
}

function savedSelection(content) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return content.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
}

function restoreSelection(range, content) {
  content.focus();
  if (!range) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function openInputDialog({ title, fields, acceptLabel }) {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog editor-input-dialog";
  const form = document.createElement("form");
  form.method = "dialog";
  form.className = "dialog-shell";
  const heading = document.createElement("h2");
  heading.textContent = title;
  form.append(heading);
  const inputs = {};
  for (const field of fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const label = document.createElement("label");
    const id = `editor-dialog-${crypto.randomUUID()}`;
    label.htmlFor = id;
    label.textContent = field.label;
    const input = document.createElement("input");
    input.id = id;
    input.name = field.name;
    input.type = field.type || "text";
    input.value = field.value || "";
    input.required = field.required !== false;
    wrapper.append(label, input);
    form.append(wrapper);
    inputs[field.name] = input;
  }
  const error = document.createElement("p");
  error.className = "form-feedback";
  error.setAttribute("role", "alert");
  const footer = document.createElement("div");
  footer.className = "dialog-footer";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "button button-quiet";
  cancel.textContent = "Annuleren";
  const accept = document.createElement("button");
  accept.type = "submit";
  accept.className = "button button-primary";
  accept.textContent = acceptLabel;
  footer.append(cancel, accept);
  form.append(error, footer);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  requestAnimationFrame(() => Object.values(inputs)[0]?.focus());

  return new Promise((resolve) => {
    const finish = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    cancel.addEventListener("click", () => finish(null));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(null); });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, input.value.trim()]));
      if (Object.values(inputs).some((input) => input.required && !input.value.trim())) {
        error.textContent = "Vul alle velden in.";
        return;
      }
      finish(values);
    });
  });
}

function insertNodeAtSelection(node, range, content) {
  restoreSelection(range, content);
  const selection = window.getSelection();
  const targetRange = selection.rangeCount ? selection.getRangeAt(0) : document.createRange();
  if (!selection.rangeCount) targetRange.selectNodeContents(content);
  targetRange.deleteContents();
  targetRange.insertNode(node);
  targetRange.setStartAfter(node);
  targetRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(targetRange);
  content.dispatchEvent(new Event("input", { bubbles: true }));
}

export function createRichTextEditor({ host, initialValue, itemPath, uploadQueue, onChange, onMessage }) {
  const shell = document.createElement("div");
  shell.className = "simple-rich-editor";
  const toolbar = document.createElement("div");
  toolbar.className = "simple-editor-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Tekstopmaak");
  const styleSelect = document.createElement("select");
  styleSelect.setAttribute("aria-label", "Tekststijl");
  styleSelect.innerHTML = '<option value="p">Gewone tekst</option><option value="h2">Grote kop</option><option value="h3">Tussenkop</option>';
  toolbar.append(styleSelect);
  const content = document.createElement("div");
  content.className = "simple-editor-content";
  content.contentEditable = "true";
  content.spellcheck = true;
  content.setAttribute("role", "textbox");
  content.setAttribute("aria-multiline", "true");
  content.setAttribute("aria-label", "Inhoud");
  content.innerHTML = markdownToHtml(expandAssetUrls(initialValue, itemPath));

  const commandButton = (label, title, command) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "simple-editor-button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => { content.focus(); document.execCommand(command, false); onChange(); });
    toolbar.append(button);
  };
  commandButton("B", "Vet", "bold");
  commandButton("I", "Cursief", "italic");
  commandButton("• Lijst", "Opsomming", "insertUnorderedList");
  commandButton("1. Lijst", "Genummerde lijst", "insertOrderedList");

  styleSelect.addEventListener("change", () => {
    content.focus();
    document.execCommand("formatBlock", false, styleSelect.value);
    onChange();
  });

  const linkButton = document.createElement("button");
  linkButton.type = "button";
  linkButton.className = "simple-editor-button";
  linkButton.textContent = "Link";
  linkButton.addEventListener("mousedown", (event) => event.preventDefault());
  linkButton.addEventListener("click", async () => {
    const range = savedSelection(content);
    const selectedText = range?.toString() || "";
    const values = await openInputDialog({
      title: "Link toevoegen",
      fields: [{ name: "text", label: "Tekst van de link", value: selectedText }, { name: "url", label: "Webadres", type: "url" }],
      acceptLabel: "Link toevoegen",
    });
    if (!values) return;
    const url = safeEditorUrl(values.url);
    if (!url) { onMessage("Vul een geldig en veilig webadres in.", "error"); return; }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.textContent = values.text;
    insertNodeAtSelection(anchor, range, content);
    onChange();
  });
  toolbar.append(linkButton);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/jpeg,image/png,image/webp";
  fileInput.className = "visually-hidden";
  const imageButton = document.createElement("button");
  imageButton.type = "button";
  imageButton.className = "simple-editor-button";
  imageButton.textContent = "Afbeelding";
  imageButton.addEventListener("mousedown", (event) => event.preventDefault());
  imageButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    const range = savedSelection(content);
    let staged;
    try {
      onMessage("Afbeelding voorbereiden…");
      staged = await uploadQueue.stage(file);
      const values = await openInputDialog({
        title: "Afbeelding beschrijven",
        fields: [{ name: "alt", label: "Wat staat er op de afbeelding?" }],
        acceptLabel: "Afbeelding toevoegen",
      });
      if (!values) { uploadQueue.remove(staged.token); return; }
      const image = document.createElement("img");
      image.src = staged.objectUrl;
      image.alt = values.alt;
      insertNodeAtSelection(image, range, content);
      onMessage(`Afbeelding klaar (${staged.width} × ${staged.height} pixels).`);
      onChange();
    } catch (err) {
      if (staged) uploadQueue.remove(staged.token);
      onMessage(err.message, "error");
    }
  });
  toolbar.append(imageButton, fileInput);

  content.addEventListener("input", onChange);
  content.addEventListener("paste", (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
  });
  shell.append(toolbar, content);
  host.append(shell);

  return {
    getMarkdown: () => collapseAssetUrls(editorHtmlToMarkdown(content), itemPath),
    setMarkdown: (value) => { content.innerHTML = markdownToHtml(expandAssetUrls(value, itemPath)); },
    focus: () => content.focus(),
    destroy: () => shell.remove(),
  };
}

export function renderMarkdownPreview(host, markdown) {
  host.innerHTML = markdownToHtml(markdown);
}
