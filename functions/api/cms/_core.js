const COOKIE_NAME = "begrip_cms_session";
const SESSION_MAX_AGE = 60 * 60 * 12;
const encoder = new TextEncoder();

const API_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

export class PublicError extends Error {
  constructor(message, status = 400, code = "invalid_request", details = undefined) {
    super(message);
    this.name = "PublicError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function withSecurityHeaders(headers = {}) {
  return new Headers({ ...API_HEADERS, ...headers });
}

export function json(data, init = {}) {
  const headers = withSecurityHeaders(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(message, status = 400, code = "invalid_request", details = undefined) {
  return json({ ok: false, error: message, code, ...(details ? { details } : {}) }, { status });
}

export function handleError(err) {
  if (err instanceof PublicError) {
    return error(err.message, err.status, err.code, err.details);
  }

  const requestId = crypto.randomUUID();
  console.error("Onverwachte CMS-fout", {
    requestId,
    name: err?.name || "Error",
    status: Number(err?.status) || 500,
  });
  return error(
    "Er ging iets mis bij het verwerken van je verzoek. Probeer het opnieuw.",
    500,
    "server_error",
    { requestId }
  );
}

function requiredEnv(env, key) {
  const value = env?.[key];
  if (!value) {
    throw new PublicError(
      "De beheeromgeving is nog niet volledig ingesteld.",
      503,
      "configuration_error"
    );
  }
  return value;
}

export function getAuthConfig(env) {
  return {
    password: requiredEnv(env, "CMS_PASSWORD"),
    sessionSecret: requiredEnv(env, "CMS_SESSION_SECRET"),
  };
}

export async function readJson(request, maxBytes = 24 * 1024 * 1024) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new PublicError(
      "Dit verzoek heeft geen geldig formaat.",
      415,
      "unsupported_media_type"
    );
  }

  const announcedSize = Number(request.headers.get("content-length") || 0);
  if (announcedSize > maxBytes) {
    throw new PublicError("Dit verzoek is te groot.", 413, "request_too_large");
  }

  const raw = await request.text();
  if (encoder.encode(raw).byteLength > maxBytes) {
    throw new PublicError("Dit verzoek is te groot.", 413, "request_too_large");
  }

  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new PublicError("Dit verzoek heeft geen geldig formaat.", 400, "invalid_json");
  }
}

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const [name, ...value] = part.split("=");
      cookies[name] = value.join("=");
      return cookies;
    }, {});
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToBytes(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importSigningKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(value, secret) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importSigningKey(secret),
    encoder.encode(value)
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifySignature(value, signature, secret) {
  try {
    const signatureBytes = base64UrlToBytes(signature);
    if (bytesToBase64Url(signatureBytes) !== signature) {
      return false;
    }
    return crypto.subtle.verify(
      "HMAC",
      await importSigningKey(secret),
      signatureBytes,
      encoder.encode(value)
    );
  } catch {
    return false;
  }
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value))));
}

export async function constantTimeEqual(left, right) {
  const leftDigest = await digest(left);
  const rightDigest = await digest(right);
  let difference = 0;
  for (let index = 0; index < leftDigest.length; index += 1) {
    difference |= leftDigest[index] ^ rightDigest[index];
  }
  return difference === 0;
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

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function createSessionCookie(secret, requestUrl) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    csrf: randomToken(),
  };
  const encodedPayload = textToBase64Url(JSON.stringify(payload));
  const signature = await sign(encodedPayload, secret);
  return `${COOKIE_NAME}=${encodedPayload}.${signature}; ${cookieFlags(requestUrl)}; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie(requestUrl) {
  return `${COOKIE_NAME}=; ${cookieFlags(requestUrl)}; Max-Age=0`;
}

export async function getSession(request, env) {
  const { sessionSecret } = getAuthConfig(env);
  const token = parseCookies(request.headers.get("cookie") || "")[COOKIE_NAME];
  if (!token) {
    return null;
  }

  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) {
    return null;
  }

  if (!(await verifySignature(encodedPayload, signature, sessionSecret))) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload)));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(payload.exp) || payload.exp <= now || !payload.csrf) {
      return null;
    }
    return { expiresAt: payload.exp, csrfToken: String(payload.csrf) };
  } catch {
    return null;
  }
}

export function assertSameOrigin(request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin && fetchSite !== "same-origin") {
    throw new PublicError("Dit verzoek is om veiligheidsredenen geweigerd.", 403, "origin_rejected");
  }
  if (origin && origin !== requestUrl.origin) {
    throw new PublicError("Dit verzoek is om veiligheidsredenen geweigerd.", 403, "origin_rejected");
  }
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    throw new PublicError("Dit verzoek is om veiligheidsredenen geweigerd.", 403, "origin_rejected");
  }
}

export async function requireSession(context, { mutation = false } = {}) {
  const session = await getSession(context.request, context.env);
  if (!session) {
    throw new PublicError("Je sessie is verlopen. Log opnieuw in.", 401, "session_expired");
  }

  if (mutation) {
    assertSameOrigin(context.request);
    const csrfToken = context.request.headers.get("x-cms-csrf") || "";
    if (!csrfToken || !(await constantTimeEqual(csrfToken, session.csrfToken))) {
      throw new PublicError(
        "Dit verzoek kon niet veilig worden bevestigd. Vernieuw de pagina en probeer opnieuw.",
        403,
        "csrf_rejected"
      );
    }
  }

  return session;
}
