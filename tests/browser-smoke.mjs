import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";

const root = new URL("../", import.meta.url).pathname;
const sampleItems = {
  events: {
    type: "events",
    path: "content/events/2026-09-01-zomeravond/index.md",
    publicUrl: "/events/2026-09-01-zomeravond/",
    sha: "event-revision",
    fields: {
      title: "Zomeravond in Assen",
      date: "2026-09-01T20:00:00.000Z",
      location: "De Witte Bal",
      organiser: "BEGR!P",
      summary: "Een avond om elkaar te ontmoeten.",
      image: "",
      image_alt: "",
      show_signup: true,
      signup_link: "https://example.com/aanmelden",
      draft: false,
    },
    body: "## Welkom\n\nKom gezellig langs voor een mooie avond.",
  },
  blogs: {
    type: "blogs",
    path: "content/blogs/2026-08-22-nieuws/index.md",
    publicUrl: "/blogs/2026-08-22-nieuws/",
    sha: "blog-revision",
    fields: {
      title: "Nieuws uit Assen",
      date: "2026-08-22",
      author: "BEGR!P",
      summary: "Een korte update over onze plannen.",
      image: "",
      image_alt: "",
      draft: true,
    },
    body: "Dit is onze **nieuwste update**.",
  },
  home: {
    type: "home",
    path: "content/_index.md",
    publicUrl: "/",
    sha: "home-revision",
    fields: {
      title: "Home Pagina",
      heading: "Met BEGR!P voor elkaar kom je verder.",
      about: "Wij zijn een groep jongeren die zich hard maakt voor Assen.",
      about_image: "",
      about_image_alt: "Over BEGR!P",
      about_link_text: "Lees verder",
      about_link_url: "/blogs/over-ons/",
      blog: "",
      newsletter: "Blijf op de hoogte van onze activiteiten.",
      support: "Jouw betrokkenheid maakt verschil.",
      support_primary_text: "Deel je idee",
      support_primary_url: "#contact-section",
      support_secondary_text: "",
      support_secondary_url: "",
      contact: "Neem gerust contact met ons op.",
      contact_phone_label: "Bel of WhatsApp",
      contact_phone: "+31 685997001",
      contact_email_label: "E-mail",
      contact_email: "contact@begripassen.nl",
      contact_instagram_label: "Instagram",
      contact_instagram_handle: "@begripassen",
      contact_instagram_url: "https://www.instagram.com/begripassen",
    },
    body: "",
  },
};

function json(response, status = 200) {
  return { status, headers: { "content-type": "application/json" }, body: JSON.stringify(response) };
}

function apiResponse(requestUrl, method, body) {
  const url = new URL(requestUrl, "http://localhost");
  if (url.pathname === "/api/cms/session") return json({ ok: true, authenticated: true, csrfToken: "browser-test-csrf", expiresAt: 4102444800 });
  if (url.pathname === "/api/cms/logout") return json({ ok: true });
  if (url.pathname === "/api/cms/items") {
    const type = url.searchParams.get("type");
    if (type === "home" || url.searchParams.has("path")) return json({ ok: true, item: sampleItems[type] });
    const item = sampleItems[type];
    return json({
      ok: true,
      items: [{
        path: item.path,
        publicUrl: item.publicUrl,
        title: item.fields.title,
        date: item.fields.date,
        draft: item.fields.draft,
        author: item.fields.author || item.fields.organiser,
        summary: item.fields.summary,
        type,
      }],
      offset: 0,
      limit: 20,
      hasMore: false,
    });
  }
  if (url.pathname === "/api/cms/save" && method === "POST") {
    const payload = JSON.parse(body || "{}");
    return json({
      ok: true,
      path: payload.path || `content/${payload.type}/2026-08-22-test/index.md`,
      publicUrl: payload.type === "home" ? "/" : `/${payload.type}/2026-08-22-test/`,
      sha: "saved-revision",
      fields: payload.fields,
      body: payload.body,
      status: payload.fields.draft ? "draft" : "published",
    });
  }
  if (url.pathname === "/api/cms/delete" && method === "POST") return json({ ok: true });
  return json({ ok: false, error: "Niet gevonden" }, 404);
}

function contentType(path) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
  }[extname(path)] || "application/octet-stream";
}

const server = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  if (request.url.startsWith("/api/cms/")) {
    const result = apiResponse(request.url, request.method, body);
    response.writeHead(result.status, result.headers);
    response.end(result.body);
    return;
  }
  const pathname = new URL(request.url, "http://localhost").pathname;
  const relative = pathname === "/admin/" ? "static/admin/index.html" : pathname.startsWith("/admin/") ? `static${pathname}` : "static/admin/index.html";
  const filePath = normalize(join(root, relative));
  if (!filePath.startsWith(normalize(root))) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.writeHead(200, { "content-type": contentType(filePath), "cache-control": "no-store" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const sitePort = server.address().port;
const debugProbe = createServer();
await new Promise((resolve) => debugProbe.listen(0, "127.0.0.1", resolve));
const debugPort = debugProbe.address().port;
await new Promise((resolve) => debugProbe.close(resolve));
const profile = await mkdtemp(join(tmpdir(), "begrip-cms-chromium-"));
const chromium = spawn("chromium", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${debugPort}`,
  `http://127.0.0.1:${sitePort}/admin/`,
], { stdio: ["ignore", "ignore", "pipe"] });

let socket;
const pending = new Map();
let messageId = 0;
const browserErrors = [];

async function connect() {
  let target;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      target = pages.find((page) => page.type === "page");
      if (target) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!target) throw new Error("Chromium debugging endpoint kwam niet beschikbaar.");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      browserErrors.push(details.exception?.description || `${details.text} at ${details.url || "onbekend"}:${details.lineNumber || 0}`);
    }
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(message.params.entry.text);
  });
}

function command(method, params = {}) {
  messageId += 1;
  const id = messageId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chromium-opdracht ${method} duurde te lang.`));
    }, 10_000);
    pending.set(id, { resolve, reject, timer });
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  const state = await evaluate(`({
    url: location.href,
    readyState: document.readyState,
    visibleViews: [...document.querySelectorAll('.view')].filter((view) => !view.classList.contains('hidden')).map((view) => view.id),
    listTitle: document.querySelector('#list-view-title')?.textContent,
    cards: document.querySelectorAll('.content-card:not(.content-card-skeleton)').length,
    announcement: document.querySelector('#announcement')?.textContent,
  })`);
  throw new Error(`Wachten op ${label} duurde te lang: ${JSON.stringify(state)}`);
}

async function screenshot(path) {
  const capture = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path, Buffer.from(capture.data, "base64"));
}

try {
  await connect();
  await command("Runtime.enable");
  await command("Log.enable");
  await command("Page.enable");
  await waitFor("document.querySelector('#workspace') && !document.querySelector('#workspace').classList.contains('hidden')", "het overzicht");
  assert.equal(await evaluate("document.documentElement.lang"), "nl");
  assert.equal(await evaluate("document.querySelectorAll('[data-open-type]').length"), 3);
  const desktopDimensions = await evaluate(`({
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth,
    overflow: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map((element) => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right) }))
  })`);
  assert.ok(desktopDimensions.scrollWidth <= desktopDimensions.width + 1, `desktop loopt horizontaal over: ${JSON.stringify(desktopDimensions)}`);
  await screenshot("/tmp/begrip-cms-overview.png");

  await evaluate("document.activeElement?.blur()");
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement.matches('a, button, input, textarea, select, [contenteditable=true]')"), true);

  await evaluate("document.querySelector('[data-open-type=events]').click()");
  await waitFor("document.querySelectorAll('.content-card:not(.content-card-skeleton)').length === 1", "de evenementenlijst");
  assert.equal(await evaluate("document.querySelector('#list-view-title').textContent"), "Evenementen");
  await evaluate("document.querySelector('.content-card button').click()");
  await waitFor("document.querySelector('.simple-rich-editor')", "de evenementeneditor");
  assert.equal(await evaluate("document.querySelector('.simple-editor-content').contentEditable"), "true");
  assert.equal(await evaluate("document.body.innerText.includes('Markdown')"), false);
  assert.equal(await evaluate("document.body.innerText.includes('content/events/')"), false);

  await evaluate(`(() => { const input = document.querySelector('[name=title]'); input.value = 'Aangepaste zomeravond'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  assert.match(await evaluate("document.querySelector('#save-state').textContent"), /niet opgeslagen/i);
  await waitFor("Object.keys(localStorage).some((key) => key.startsWith('begrip-cms-draft:v2:events'))", "de lokale reservekopie");
  const previousTimeOrigin = await evaluate("performance.timeOrigin");
  const navigation = command("Page.navigate", { url: `http://127.0.0.1:${sitePort}/admin/` });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await command("Page.handleJavaScriptDialog", { accept: true });
  await navigation;
  await waitFor(`performance.timeOrigin !== ${previousTimeOrigin}`, "het nieuwe document na herladen");
  await waitFor("document.querySelector('#workspace') && !document.querySelector('#workspace').classList.contains('hidden')", "het overzicht na herladen");
  await evaluate("document.querySelector('[data-open-type=events]').click()");
  await waitFor("document.querySelectorAll('.content-card:not(.content-card-skeleton)').length === 1", "de evenementenlijst na herladen");
  await evaluate("document.querySelector('.content-card button').click()");
  await waitFor("document.querySelector('#recovery-banner') && !document.querySelector('#recovery-banner').classList.contains('hidden')", "het herstelvoorstel");
  await evaluate("document.querySelector('#restore-draft-button').click()");
  await waitFor("document.querySelector('[name=title]').value === 'Aangepaste zomeravond'", "de herstelde lokale versie");
  await evaluate("document.querySelector('#preview-button').click()");
  await waitFor("document.querySelector('#content-preview-dialog').open", "het voorbeeld");
  assert.equal(await evaluate("document.querySelector('#preview-content-title').textContent"), "Aangepaste zomeravond");
  await evaluate("document.querySelector('[data-close-dialog=content-preview-dialog]').click()");

  await evaluate("document.querySelector('#editor-back-button').click()");
  await waitFor("document.querySelector('#confirmation-dialog').open", "de waarschuwing voor niet-opgeslagen werk");
  assert.match(await evaluate("document.querySelector('#confirm-message').textContent"), /lokale reservekopie/i);
  await evaluate("document.querySelector('#confirm-cancel').click()");
  assert.equal(await evaluate("document.querySelector('#editor-view').classList.contains('hidden')"), false);

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((resolve) => setTimeout(resolve, 200));
  const dimensions = await evaluate("({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth })");
  assert.ok(dimensions.scrollWidth <= dimensions.width + 1, `mobiele pagina loopt horizontaal over: ${JSON.stringify(dimensions)}`);
  await screenshot("/tmp/begrip-cms-editor-mobile.png");

  await command("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('#save-draft-button').click()");
  await waitFor("document.querySelector('#save-state').textContent.includes('Concept opgeslagen')", "het opslaan als concept");
  await evaluate("document.querySelector('#editor-back-button').click()");
  await waitFor("!document.querySelector('#list-view').classList.contains('hidden')", "de evenementenlijst na opslaan");

  await evaluate("document.querySelector('[data-route=home]').click()");
  await waitFor("document.querySelectorAll('#home-section-tabs button').length === 5", "de homepagina-editor");
  assert.equal(await evaluate("document.querySelectorAll('.rich-editor-host').length"), 0);
  await evaluate("document.querySelector('[data-home-section=contact]').click()");
  assert.equal(await evaluate("!document.querySelector('[name=contact_email]').closest('.form-section').classList.contains('hidden')"), true);

  await evaluate("document.querySelector('[data-route=blogs]').click()");
  await waitFor("document.querySelector('#list-view-title').textContent === 'Blogs' && document.querySelectorAll('.content-card:not(.content-card-skeleton)').length === 1", "de bloglijst");
  await evaluate("document.querySelector('.content-card button').click()");
  await waitFor("document.querySelector('.simple-rich-editor')", "de blogeditor");
  assert.equal(await evaluate("Boolean(document.querySelector('[name=author]'))"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('[name=summary]'))"), true);

  assert.deepEqual(browserErrors, []);
  process.stdout.write(JSON.stringify({
    ok: true,
    checks: ["dashboard", "events list", "event save", "homepage sections", "blog editor", "WYSIWYG-only editor", "keyboard focus", "reload recovery", "dirty warning", "preview", "desktop/mobile overflow", "console errors"],
    screenshots: ["/tmp/begrip-cms-overview.png", "/tmp/begrip-cms-editor-mobile.png"],
  }, null, 2) + "\n");
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (chromium.exitCode === null) {
    const exited = new Promise((resolve) => chromium.once("exit", resolve));
    chromium.kill("SIGTERM");
    const stopped = await Promise.race([
      exited.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 2_000)),
    ]);
    if (!stopped && chromium.exitCode === null) {
      chromium.kill("SIGKILL");
      await exited;
    }
  }
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}
