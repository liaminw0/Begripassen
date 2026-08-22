import { PublicError } from "./_core.js";

export const CMS_TYPES = {
  home: { path: "content/_index.md", label: "Homepagina" },
  events: { path: "content/events", label: "Evenementen" },
  blogs: { path: "content/blogs", label: "Blogs" },
};

const TYPE_FIELDS = {
  home: new Set([
    "title", "heading", "about", "about_image", "about_image_alt", "about_link_text",
    "about_link_url", "blog", "newsletter", "support", "support_primary_text",
    "support_primary_url", "support_secondary_text", "support_secondary_url", "contact",
    "contact_phone_label", "contact_phone", "contact_email_label", "contact_email",
    "contact_instagram_label", "contact_instagram_handle", "contact_instagram_url",
  ]),
  events: new Set([
    "title", "date", "location", "organiser", "image", "image_alt", "show_signup",
    "signup_link", "draft", "summary",
  ]),
  blogs: new Set(["title", "date", "author", "image", "image_alt", "draft", "summary"]),
};

const FIELD_ALIASES = {
  home: {
    Title: "title", Heading: "heading", About: "about", AboutImage: "about_image",
    AboutImageAlt: "about_image_alt", AboutLinkText: "about_link_text",
    AboutLinkUrl: "about_link_url", Blog: "blog", Newsletter: "newsletter",
    Contact: "contact", Support: "support", SupportPrimaryText: "support_primary_text",
    SupportPrimaryUrl: "support_primary_url", SupportSecondaryText: "support_secondary_text",
    SupportSecondaryUrl: "support_secondary_url", ContactPhoneLabel: "contact_phone_label",
    ContactPhone: "contact_phone", ContactEmailLabel: "contact_email_label",
    ContactEmail: "contact_email", ContactInstagramLabel: "contact_instagram_label",
    ContactInstagramHandle: "contact_instagram_handle", ContactInstagramUrl: "contact_instagram_url",
  },
  events: { author: "organiser" },
  blogs: {},
};

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_BODY_LENGTH = 120_000;

export function getTypeDefinition(type) {
  return CMS_TYPES[type] || null;
}

function cleanString(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function booleanValue(value) {
  return value === true || value === "true";
}

function withAliases(type, rawFields = {}) {
  const result = { ...rawFields };
  for (const [oldKey, currentKey] of Object.entries(FIELD_ALIASES[type] || {})) {
    if ((result[currentKey] === undefined || result[currentKey] === "") && result[oldKey] !== undefined) {
      result[currentKey] = result[oldKey];
    }
  }
  return result;
}

export function normalizeFields(type, rawFields = {}) {
  const fields = withAliases(type, rawFields);
  if (type === "home") {
    return {
      title: cleanString(fields.title) || "Home Pagina",
      heading: cleanString(fields.heading),
      about: cleanString(fields.about),
      about_image: cleanString(fields.about_image),
      about_image_alt: cleanString(fields.about_image_alt) || "Over BEGR!P",
      about_link_text: cleanString(fields.about_link_text),
      about_link_url: cleanString(fields.about_link_url),
      blog: cleanString(fields.blog),
      newsletter: cleanString(fields.newsletter),
      support: cleanString(fields.support),
      support_primary_text: cleanString(fields.support_primary_text),
      support_primary_url: cleanString(fields.support_primary_url),
      support_secondary_text: cleanString(fields.support_secondary_text),
      support_secondary_url: cleanString(fields.support_secondary_url),
      contact: cleanString(fields.contact),
      contact_phone_label: cleanString(fields.contact_phone_label),
      contact_phone: cleanString(fields.contact_phone),
      contact_email_label: cleanString(fields.contact_email_label),
      contact_email: cleanString(fields.contact_email),
      contact_instagram_label: cleanString(fields.contact_instagram_label),
      contact_instagram_handle: cleanString(fields.contact_instagram_handle),
      contact_instagram_url: cleanString(fields.contact_instagram_url),
    };
  }
  if (type === "events") {
    return {
      title: cleanString(fields.title),
      date: normalizeEventDate(fields.date),
      location: cleanString(fields.location),
      organiser: cleanString(fields.organiser),
      image: cleanString(fields.image),
      image_alt: cleanString(fields.image_alt) || cleanString(fields.title),
      show_signup: booleanValue(fields.show_signup),
      signup_link: cleanString(fields.signup_link),
      draft: booleanValue(fields.draft),
      summary: cleanString(fields.summary),
    };
  }
  if (type === "blogs") {
    return {
      title: cleanString(fields.title),
      date: normalizeBlogDate(fields.date),
      author: cleanString(fields.author),
      image: cleanString(fields.image),
      image_alt: cleanString(fields.image_alt) || cleanString(fields.title),
      draft: booleanValue(fields.draft),
      summary: cleanString(fields.summary),
    };
  }
  throw new PublicError("Onbekend inhoudstype.", 400, "unknown_type");
}

function parseScalar(rawValue) {
  const value = rawValue.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export function parseMarkdownFile(markdown) {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const isYaml = normalized.startsWith("---\n");
  const isToml = normalized.startsWith("+++\n");
  if (!isYaml && !isToml) return { fields: {}, body: normalized.trim() };

  const delimiter = isToml ? "+++" : "---";
  const separator = `\n${delimiter}\n`;
  const endIndex = normalized.indexOf(separator, 4);
  if (endIndex === -1) {
    throw new PublicError("De opgeslagen inhoud heeft ongeldige metadata.", 422, "malformed_content");
  }

  const fields = {};
  for (const line of normalized.slice(4, endIndex).split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const divider = isToml ? line.indexOf("=") : line.indexOf(":");
    if (divider < 1) {
      throw new PublicError("De opgeslagen inhoud heeft ongeldige metadata.", 422, "malformed_content");
    }
    const key = line.slice(0, divider).trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
      throw new PublicError("De opgeslagen inhoud heeft ongeldige metadata.", 422, "malformed_content");
    }
    fields[key] = parseScalar(line.slice(divider + 1));
  }
  return { fields, body: normalized.slice(endIndex + separator.length).trim() };
}

function yamlScalar(value) {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

export function serializeMarkdownFile(fields, body) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${yamlScalar(value)}`);
  return `---\n${lines.join("\n")}\n---\n${cleanString(body)}\n`;
}

export function serializeTomlMarkdownFile(fields, body) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${key} = ${typeof value === "boolean" || typeof value === "number" ? value : JSON.stringify(String(value))}`);
  return `+++\n${lines.join("\n")}\n+++\n${cleanString(body)}\n`;
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 90);
}

function normalizeEventDate(value) {
  const raw = cleanString(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return `${raw}.000Z`;
  return raw;
}

function normalizeBlogDate(value) {
  const raw = cleanString(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
}

function datePrefix(value) {
  return String(value || "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || new Date().toISOString().slice(0, 10);
}

export function assertContentPath(type, path) {
  const definition = getTypeDefinition(type);
  if (!definition) throw new PublicError("Onbekend inhoudstype.", 400, "unknown_type");
  const value = String(path || "");
  if (type === "home") {
    if (value !== definition.path) throw new PublicError("Ongeldig inhoudspad.", 400, "invalid_path");
    return value;
  }

  if (!value.startsWith(`${definition.path}/`) || /[\\\u0000-\u001f?#]/.test(value) || value.includes("..")) {
    throw new PublicError("Ongeldig inhoudspad.", 400, "invalid_path");
  }
  const parts = value.slice(definition.path.length + 1).split("/");
  const validSegment = (segment) => segment && segment !== "." && segment.length <= 180;
  const isFlatFile = parts.length === 1 && validSegment(parts[0]) && parts[0] !== "_index.md" && parts[0].endsWith(".md");
  const isBundle = parts.length === 2 && validSegment(parts[0]) && parts[1] === "index.md";
  if (!isFlatFile && !isBundle) throw new PublicError("Ongeldig inhoudspad.", 400, "invalid_path");
  return value;
}

export function buildContentPath(type, fields, currentPath = "") {
  if (type === "home") return CMS_TYPES.home.path;
  if (currentPath) return assertContentPath(type, currentPath);
  const slug = slugify(fields.title);
  if (!slug) throw new PublicError("Vul een titel in waar een webadres van gemaakt kan worden.", 422, "validation_failed", { fields: { title: "Gebruik letters of cijfers in de titel." } });
  return `${CMS_TYPES[type].path}/${datePrefix(fields.date)}-${slug}/index.md`;
}

export function publicUrlForPath(path) {
  const relative = String(path).replace(/^content\//, "");
  if (relative.endsWith("/index.md")) return `/${relative.slice(0, -"index.md".length)}`;
  return `/${relative.replace(/\.md$/, "/")}`;
}

function validateLength(value, max, field, errors) {
  if (String(value || "").length > max) errors[field] = `Gebruik maximaal ${max} tekens.`;
}

function isRealDate(value, needsTime) {
  const expression = needsTime
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{3})?Z?)?$/
    : /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = String(value).match(expression);
  if (!match) return false;
  const [, year, month, day, hour = "0", minute = "0"] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day) && Number(hour) < 24 && Number(minute) < 60;
}

function safeWebUrl(value, { relative = false } = {}) {
  const raw = cleanString(value);
  if (!raw) return "";
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (relative && (raw.startsWith("/") || raw.startsWith("#"))) return raw;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function validImageReference(value) {
  if (!value) return true;
  if (/[\\\u0000-\u001f?#]/.test(value) || value.includes("..")) return false;
  if (/^https:\/\//i.test(value)) return true;
  return /^media\/[a-z0-9][a-z0-9._-]*$/i.test(value) || /^\/images\/uploads\/[a-z0-9][a-z0-9._-]*$/i.test(value) || /^__CMS_UPLOAD_[a-f0-9-]+__$/.test(value);
}

function validateMarkdown(body, errors) {
  if (!body) { errors.body = "Schrijf eerst de inhoud."; return; }
  if (body.length > MAX_BODY_LENGTH) { errors.body = "De inhoud is te lang."; return; }
  if (/<\/?[a-z][^>]*>/i.test(body) || /\{\{[<%]/.test(body)) {
    errors.body = "HTML en technische codes zijn niet toegestaan.";
    return;
  }
  for (const match of body.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    const target = match[1].replace(/^<|>$/g, "");
    const scheme = target.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
    if ((scheme && !["http", "https", "mailto", "tel"].includes(scheme)) || target.includes("..")) {
      errors.body = "De inhoud bevat een onveilige link of afbeelding.";
      return;
    }
  }
}

function assertSubmittedKeys(type, rawFields) {
  if (!rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) {
    throw new PublicError("De ingevulde velden zijn ongeldig.", 400, "invalid_fields");
  }
  const invalidKeys = Object.keys(rawFields).filter((key) => !TYPE_FIELDS[type]?.has(key));
  if (invalidKeys.length) throw new PublicError("De ingevulde velden zijn ongeldig.", 400, "invalid_fields");
}

export function validateContent(type, rawFields, body = "") {
  assertSubmittedKeys(type, rawFields);
  const fields = normalizeFields(type, rawFields);
  const errors = {};

  if (type === "home") {
    for (const field of ["heading", "about", "newsletter", "support", "contact"]) {
      if (!fields[field]) errors[field] = "Dit veld is verplicht.";
      validateLength(fields[field], 2_000, field, errors);
    }
    for (const field of ["about_link_text", "support_primary_text", "support_secondary_text", "contact_phone_label", "contact_email_label", "contact_instagram_label", "contact_instagram_handle"]) {
      validateLength(fields[field], 120, field, errors);
    }
    for (const field of ["about_link_url", "support_primary_url", "support_secondary_url", "contact_instagram_url"]) {
      if (fields[field]) {
        const normalized = safeWebUrl(fields[field], { relative: true });
        if (!normalized) errors[field] = "Vul een geldig en veilig webadres in.";
        else fields[field] = normalized;
      }
    }
    if (fields.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contact_email)) {
      errors.contact_email = "Vul een geldig e-mailadres in.";
    }
    if (!validImageReference(fields.about_image)) errors.about_image = "Kies de afbeelding opnieuw.";
    if (fields.about_image && !fields.about_image_alt) errors.about_image_alt = "Beschrijf kort wat er op de afbeelding staat.";
  }

  if (type === "events" || type === "blogs") {
    if (!fields.title) errors.title = "Vul een titel in.";
    validateLength(fields.title, 140, "title", errors);
    if (!fields.date || !isRealDate(fields.date, type === "events")) errors.date = type === "events" ? "Kies een geldige datum en tijd." : "Kies een geldige datum.";
    validateLength(fields.summary, 280, "summary", errors);
    validateLength(fields.image_alt, 180, "image_alt", errors);
    if (!validImageReference(fields.image)) errors.image = "Kies de afbeelding opnieuw.";
    if (fields.image && !fields.image_alt) errors.image_alt = "Beschrijf kort wat er op de afbeelding staat.";
    validateMarkdown(cleanString(body), errors);
  }

  if (type === "events") {
    validateLength(fields.location, 180, "location", errors);
    validateLength(fields.organiser, 180, "organiser", errors);
    if (fields.show_signup) {
      const signupUrl = safeWebUrl(fields.signup_link);
      if (!signupUrl) errors.signup_link = "Vul een geldige aanmeldlink in.";
      else fields.signup_link = signupUrl;
    } else {
      fields.signup_link = "";
    }
  }

  if (type === "blogs") {
    validateLength(fields.author, 120, "author", errors);
    if (!fields.summary) errors.summary = "Schrijf een korte samenvatting.";
  }

  if (Object.keys(errors).length) {
    throw new PublicError("Controleer de gemarkeerde velden.", 422, "validation_failed", { fields: errors });
  }
  return { fields, body: cleanString(body) };
}

export function mergePreservedFields(type, existingFields = {}, normalizedFields) {
  const aliases = new Set(Object.keys(FIELD_ALIASES[type] || {}));
  const known = TYPE_FIELDS[type];
  const preserved = {};
  for (const [key, value] of Object.entries(existingFields || {})) {
    if (!known.has(key) && !aliases.has(key) && /^[A-Za-z][A-Za-z0-9_-]*$/.test(key) && ["string", "number", "boolean"].includes(typeof value)) {
      preserved[key] = value;
    }
  }
  return { ...preserved, ...normalizedFields };
}

export function summarizeItem(type, path, fields, body) {
  return {
    path,
    publicUrl: publicUrlForPath(path),
    title: fields.title || "Zonder titel",
    date: fields.date || "",
    draft: Boolean(fields.draft),
    author: fields.author || fields.organiser || "",
    summary: fields.summary || cleanString(body).split("\n").find(Boolean) || "",
    type,
  };
}

function isBundlePath(path) {
  return /\/index\.md$/.test(path);
}

function dirname(path) {
  return path.replace(/\/[^/]+$/, "");
}

export function sanitizeUploadFilename(filename, mimeType) {
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new PublicError("Gebruik een JPG-, PNG- of WebP-afbeelding.", 422, "unsupported_image");
  const base = slugify(String(filename || "").replace(/\.[^/.]+$/, "")) || "afbeelding";
  return `${base}.${extension}`;
}

export function validateUpload(upload) {
  if (!upload || typeof upload !== "object") throw new PublicError("Een afbeelding is ongeldig.", 422, "invalid_image");
  const { filename, mimeType, base64, token } = upload;
  if (!/^__CMS_UPLOAD_[a-f0-9-]+__$/.test(String(token || ""))) throw new PublicError("Een afbeelding is ongeldig.", 422, "invalid_image");
  sanitizeUploadFilename(filename, mimeType);
  const normalizedBase64 = String(base64 || "").replace(/\s/g, "");
  if (!normalizedBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)) throw new PublicError("Een afbeelding is beschadigd.", 422, "invalid_image");
  const approximateBytes = Math.floor((normalizedBase64.length * 3) / 4);
  if (approximateBytes > MAX_IMAGE_BYTES) throw new PublicError("Een afbeelding is groter dan 6 MB.", 413, "image_too_large");
  let bytes;
  try { bytes = Uint8Array.from(atob(normalizedBase64), (character) => character.charCodeAt(0)); }
  catch { throw new PublicError("Een afbeelding is beschadigd.", 422, "invalid_image"); }
  const signatures = {
    "image/jpeg": bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    "image/png": bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
    "image/webp": String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  };
  if (!signatures[mimeType]) throw new PublicError("Het bestand is geen geldige afbeelding.", 422, "invalid_image");
  return { token, filename, mimeType, base64: normalizedBase64, byteLength: bytes.length };
}

export function buildUploadTarget(type, contentPath, filename, mimeType) {
  const uniqueName = `${crypto.randomUUID()}-${sanitizeUploadFilename(filename, mimeType)}`;
  if ((type === "events" || type === "blogs") && isBundlePath(contentPath)) {
    return { filepath: `${dirname(contentPath)}/media/${uniqueName}`, fieldPath: `media/${uniqueName}` };
  }
  const filepath = `static/images/uploads/${uniqueName}`;
  return { filepath, fieldPath: `/${filepath.replace(/^static\//, "")}` };
}
