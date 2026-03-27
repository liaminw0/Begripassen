const COOKIE_NAME = "begrip_cms_session";
const SESSION_MAX_AGE = 60 * 60 * 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CMS_TYPES = {
  home: {
    path: "content/_index.md",
    label: "Homepage",
  },
  events: {
    path: "content/events",
    label: "Events",
  },
  blogs: {
    path: "content/blogs",
    label: "Blogs",
  },
};

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function error(message, status = 400) {
  return json({ ok: false, error: message }, { status });
}

function getRequiredEnv(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required binding: ${key}`);
  }
  return value;
}

export function getCmsConfig(env) {
  return {
    owner: getRequiredEnv(env, "GITHUB_OWNER"),
    repo: getRequiredEnv(env, "GITHUB_REPO"),
    branch: env.GITHUB_BRANCH || "main",
    token: getRequiredEnv(env, "GITHUB_TOKEN"),
    password: getRequiredEnv(env, "CMS_PASSWORD"),
    sessionSecret: getRequiredEnv(env, "CMS_SESSION_SECRET"),
    committerName: env.GITHUB_COMMITTER_NAME || "",
    committerEmail: env.GITHUB_COMMITTER_EMAIL || "",
  };
}

export function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [name, ...value] = part.split("=");
      acc[name] = value.join("=");
      return acc;
    }, {});
}

function toBase64Url(input) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return atob(padded);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return toBase64Url(binary);
}

function cookieFlags(requestUrl) {
  const url = new URL(requestUrl);
  return [
    "Path=/",
    "HttpOnly",
    url.protocol === "https:" && url.hostname !== "localhost" ? "Secure" : "",
    "SameSite=Strict",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function createSessionCookie(secret, requestUrl) {
  const payload = JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  });
  const encodedPayload = toBase64Url(payload);
  const signature = await sign(encodedPayload, secret);
  return `${COOKIE_NAME}=${encodedPayload}.${signature}; ${cookieFlags(requestUrl)}; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie(requestUrl) {
  return `${COOKIE_NAME}=; ${cookieFlags(requestUrl)}; Max-Age=0`;
}

export async function isAuthenticated(request, env) {
  let config;
  try {
    config = getCmsConfig(env);
  } catch {
    return false;
  }

  const cookies = parseCookies(request.headers.get("cookie") || "");
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = await sign(encodedPayload, config.sessionSecret);
  if (signature !== expectedSignature) {
    return false;
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    return false;
  }

  return Boolean(payload.exp && payload.exp > Math.floor(Date.now() / 1000));
}

export async function requireAuth(context) {
  if (!(await isAuthenticated(context.request, context.env))) {
    return error("Unauthorized", 401);
  }
  return null;
}

export function getTypeDefinition(type) {
  return CMS_TYPES[type] || null;
}

async function githubRequest(config, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("accept", "application/vnd.github+json");
  headers.set("authorization", `Bearer ${config.token}`);
  headers.set("user-agent", "begrip-cms");

  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return response;
}

export async function listRepoDirectory(config, path) {
  const response = await githubRequest(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`
  );
  return response.json();
}

export async function getRepoFile(config, path) {
  const response = await githubRequest(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`
  );
  const data = await response.json();
  const content = data.content ? decoder.decode(Uint8Array.from(atob(data.content.replace(/\n/g, "")), (char) => char.charCodeAt(0))) : "";
  return {
    sha: data.sha,
    content,
    path: data.path,
    name: data.name,
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function toBase64(content) {
  return bytesToBase64(encoder.encode(content));
}

export async function putRepoFile(config, path, content, message, sha) {
  return putRepoFileBase64(config, path, toBase64(content), message, sha);
}

export async function putRepoFileBase64(config, path, contentBase64, message, sha) {
  const body = {
    message,
    content: contentBase64,
    branch: config.branch,
  };

  if (sha) {
    body.sha = sha;
  }

  if (config.committerName && config.committerEmail) {
    body.committer = {
      name: config.committerName,
      email: config.committerEmail,
    };
  }

  const response = await githubRequest(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${path}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );

  return response.json();
}

function parseFrontmatterValue(rawValue) {
  const trimmed = rawValue.trim();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function parseMarkdownFile(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    return { fields: {}, body: normalized.trim() };
  }

  const endIndex = normalized.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { fields: {}, body: normalized.trim() };
  }

  const rawFrontmatter = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 5).trim();
  const fields = {};

  for (const line of rawFrontmatter.split("\n")) {
    const divider = line.indexOf(":");
    if (divider === -1) {
      continue;
    }

    const key = line.slice(0, divider).trim();
    const value = line.slice(divider + 1);
    fields[key] = parseFrontmatterValue(value);
  }

  return { fields, body };
}

function formatFrontmatterValue(value) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (stringValue === "") {
    return "";
  }

  if (/[:#\n]/.test(stringValue) || stringValue !== stringValue.trim()) {
    return JSON.stringify(stringValue);
  }

  return stringValue;
}

export function serializeMarkdownFile(fields, body) {
  const frontmatterLines = Object.entries(fields)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${formatFrontmatterValue(value)}`);

  const normalizedBody = (body || "").replace(/\r\n/g, "\n").trim();
  return `---\n${frontmatterLines.join("\n")}\n---\n${normalizedBody}\n`;
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function datePrefix(dateValue) {
  if (!dateValue) {
    return new Date().toISOString().slice(0, 10);
  }

  const match = String(dateValue).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : new Date().toISOString().slice(0, 10);
}

export function buildContentPath(type, fields, currentPath) {
  if (type === "home") {
    return CMS_TYPES.home.path;
  }

  if (currentPath) {
    return currentPath;
  }

  const definition = getTypeDefinition(type);
  const singular = type.endsWith("s") ? type.slice(0, -1) : type;
  const slug = slugify(fields.slug || fields.title || `nieuw-${singular}`);
  const filename = `${datePrefix(fields.date)}-${slug}.md`;
  return `${definition.path}/${filename}`;
}

export function normalizeFields(type, rawFields) {
  if (type === "home") {
    return {
      title: rawFields.title || rawFields.Title || "Home Pagina",
      heading: rawFields.heading || rawFields.Heading || "",
      about: rawFields.about || rawFields.About || "",
      blog: rawFields.blog || rawFields.Blog || "",
      newsletter: rawFields.newsletter || rawFields.Newsletter || "",
      contact: rawFields.contact || rawFields.Contact || "",
      support: rawFields.support || rawFields.Support || "",
    };
  }

  if (type === "events") {
    return {
      title: rawFields.title || "",
      date: rawFields.date || "",
      location: rawFields.location || "",
      organiser: rawFields.organiser || rawFields.author || "",
      image: rawFields.image || "",
      show_signup: Boolean(rawFields.show_signup),
      signup_link: rawFields.signup_link || "",
      draft: Boolean(rawFields.draft),
      summary: rawFields.summary || "",
    };
  }

  if (type === "blogs") {
    return {
      title: rawFields.title || "",
      date: rawFields.date || "",
      author: rawFields.author || "",
      image: rawFields.image || "",
      draft: Boolean(rawFields.draft),
      summary: rawFields.summary || "",
    };
  }

  return rawFields;
}

export function summarizeItem(type, path, fields, body) {
  return {
    path,
    title: fields.title || "Zonder titel",
    date: fields.date || "",
    draft: Boolean(fields.draft),
    author: fields.author || fields.organiser || "",
    summary: fields.summary || body.split("\n").find(Boolean) || "",
    type,
  };
}

export { error, json };
