import test from "node:test";
import assert from "node:assert/strict";
import {
  PublicError,
  createSessionCookie,
  getSession,
  requireSession,
} from "../functions/api/cms/_core.js";
import {
  assertContentPath,
  buildContentPath,
  normalizeFields,
  normalizeEventDate,
  parseMarkdownFile,
  serializeMarkdownFile,
  serializeTomlMarkdownFile,
  validateContent,
  validateUpload,
} from "../functions/api/cms/_content.js";
import { onRequestPost as login } from "../functions/api/cms/login.js";
import { onRequestPost as logout } from "../functions/api/cms/logout.js";
import { onRequestGet as getItems } from "../functions/api/cms/items.js";
import { onRequestPost as saveItem } from "../functions/api/cms/save.js";
import { createEmptyItem, validateItem } from "../static/admin/content-model.js";

const authEnv = {
  CMS_PASSWORD: "bestaand-teamwachtwoord",
  CMS_SESSION_SECRET: "een-lang-bestaand-testsessie-geheim",
};

test("bestaande YAML- en TOML-inhoud blijft leesbaar en serializeerbaar", () => {
  const yaml = `---\ntitle: "BEGR!P: samen"\ndraft: false\ndate: "2026-04-01T19:30:00.000Z"\n---\nWelkom **allemaal**.\n`;
  const parsedYaml = parseMarkdownFile(yaml);
  assert.equal(parsedYaml.fields.title, "BEGR!P: samen");
  assert.equal(parsedYaml.fields.draft, false);
  assert.equal(parseMarkdownFile(serializeMarkdownFile(parsedYaml.fields, parsedYaml.body)).body, "Welkom **allemaal**.");

  const toml = `+++\ntitle = "Home Pagina"\nheading = "Samen verder"\n+++\n`;
  const parsedToml = parseMarkdownFile(toml);
  assert.equal(parsedToml.fields.heading, "Samen verder");
  assert.equal(parseMarkdownFile(serializeTomlMarkdownFile(parsedToml.fields, "")).fields.title, "Home Pagina");
});

test("alleen bekende inhoudspaden worden geaccepteerd", () => {
  assert.equal(assertContentPath("home", "content/_index.md"), "content/_index.md");
  assert.equal(
    assertContentPath("blogs", "content/blogs/2024-07-22-fijne-zomervakantie-☀️-van-het-begr-p-team/index.md"),
    "content/blogs/2024-07-22-fijne-zomervakantie-☀️-van-het-begr-p-team/index.md"
  );
  assert.throws(() => assertContentPath("blogs", "functions/api/cms/login.js"), PublicError);
  assert.throws(() => assertContentPath("blogs", "content/blogs/../../config.toml"), PublicError);
  assert.throws(() => assertContentPath("events", "content/blogs/bericht/index.md"), PublicError);
  assert.throws(() => assertContentPath("events", "content/events/bericht/media/foto.webp"), PublicError);
});

test("nieuwe paden zijn stabiele Hugo-bundels met datum en slug", () => {
  assert.equal(
    buildContentPath("blogs", { title: "Hé Assen! Wat nu?", date: "2026-08-22" }),
    "content/blogs/2026-08-22-he-assen-wat-nu/index.md"
  );
  assert.equal(
    buildContentPath("events", { title: "Borrel", date: "2026-09-01T20:00" }, "content/events/bestaand/index.md"),
    "content/events/bestaand/index.md"
  );
});

test("evenementstijden worden als Nederlandse lokale tijd met zomer- en wintertijd opgeslagen", () => {
  assert.equal(normalizeEventDate("2026-01-15T19:30"), "2026-01-15T19:30:00.000+01:00");
  assert.equal(normalizeEventDate("2026-07-15T19:30"), "2026-07-15T19:30:00.000+02:00");
  assert.equal(normalizeFields("events", { date: "2026-09-01T20:00" }).date, "2026-09-01T20:00:00.000+02:00");
});

test("servervalidatie blokkeert onveilige links, HTML en ongeldige content", () => {
  const event = {
    title: "Veilige avond",
    date: "2026-09-01T20:00",
    location: "Assen",
    organiser: "BEGR!P",
    image: "",
    image_alt: "",
    show_signup: true,
    signup_link: "javascript:alert(1)",
    draft: false,
    summary: "Een mooie avond.",
  };
  assert.throws(
    () => validateContent("events", event, "Welkom bij de avond."),
    (error) => error.code === "validation_failed" && Boolean(error.details.fields.signup_link)
  );
  assert.throws(
    () => validateContent("events", { ...event, show_signup: false, signup_link: "" }, "<script>alert(1)</script>"),
    (error) => Boolean(error.details.fields.body)
  );
  assert.throws(
    () => validateContent("blogs", { title: "", date: "niet-echt", author: "", image: "", image_alt: "", draft: true, summary: "" }, ""),
    (error) => Object.keys(error.details.fields).includes("title") && Object.keys(error.details.fields).includes("date")
  );
});

test("alleen echte JPG-, PNG- en WebP-uploads binnen de limiet worden geaccepteerd", () => {
  const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const base64 = Buffer.from(pngHeader).toString("base64");
  const valid = validateUpload({
    token: "__CMS_UPLOAD_123e4567-e89b-12d3-a456-426614174000__",
    filename: "mooie foto.png",
    mimeType: "image/png",
    base64,
  });
  assert.equal(valid.byteLength, pngHeader.length);
  assert.throws(() => validateUpload({ ...valid, filename: "code.svg", mimeType: "image/svg+xml" }), PublicError);
  assert.throws(() => validateUpload({ ...valid, base64: Buffer.from("geen afbeelding").toString("base64") }), PublicError);
});

test("sessies zijn ondertekend, verlopen client-side en vereisen CSRF bij mutaties", async () => {
  const cookie = await createSessionCookie(authEnv.CMS_SESSION_SECRET, "https://begripassen.nl/admin/");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, new RegExp(authEnv.CMS_SESSION_SECRET));
  const cookiePair = cookie.split(";")[0];
  const sessionRequest = new Request("https://begripassen.nl/api/cms/session", { headers: { cookie: cookiePair } });
  const session = await getSession(sessionRequest, authEnv);
  assert.ok(session.csrfToken);

  const mutationRequest = new Request("https://begripassen.nl/api/cms/save", {
    method: "POST",
    headers: {
      cookie: cookiePair,
      origin: "https://begripassen.nl",
      "sec-fetch-site": "same-origin",
      "x-cms-csrf": session.csrfToken,
    },
  });
  await assert.doesNotReject(() => requireSession({ request: mutationRequest, env: authEnv }, { mutation: true }));

  const rejectedRequest = new Request("https://begripassen.nl/api/cms/save", {
    method: "POST",
    headers: { cookie: cookiePair, origin: "https://kwaad.example", "x-cms-csrf": session.csrfToken },
  });
  await assert.rejects(
    () => requireSession({ request: rejectedRequest, env: authEnv }, { mutation: true }),
    (error) => error.code === "origin_rejected"
  );

  const [name, token] = cookiePair.split("=");
  const tampered = `${name}=${token.slice(0, -1)}x`;
  assert.equal(await getSession(new Request("https://begripassen.nl/api/cms/session", { headers: { cookie: tampered } }), authEnv), null);

  const originalNow = Date.now;
  Date.now = () => originalNow() + 13 * 60 * 60 * 1000;
  try {
    assert.equal(await getSession(sessionRequest, authEnv), null);
  } finally {
    Date.now = originalNow;
  }

  const logoutResponse = await logout({ request: mutationRequest, env: authEnv });
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie"), /Max-Age=0/);
});

test("login gebruikt het bestaande geheim zonder dit in de response bloot te geven", async () => {
  const rejected = await login({
    request: new Request("https://begripassen.nl/api/cms/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://begripassen.nl" },
      body: JSON.stringify({ password: "onjuist-wachtwoord" }),
    }),
    env: authEnv,
  });
  assert.equal(rejected.status, 401);
  assert.equal(rejected.headers.get("set-cookie"), null);

  const response = await login({
    request: new Request("https://begripassen.nl/api/cms/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://begripassen.nl" },
      body: JSON.stringify({ password: authEnv.CMS_PASSWORD }),
    }),
    env: authEnv,
  });
  assert.equal(response.status, 200);
  const responseText = await response.clone().text();
  assert.doesNotMatch(responseText, new RegExp(authEnv.CMS_PASSWORD));
  assert.doesNotMatch(response.headers.get("set-cookie"), new RegExp(authEnv.CMS_PASSWORD));
});

test("directe API-uitlezing kan niet buiten het inhoudstype komen", async () => {
  const cookie = await createSessionCookie(authEnv.CMS_SESSION_SECRET, "https://begripassen.nl/admin/");
  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetched = true; throw new Error("fetch should not be called"); };
  try {
    const response = await getItems({
      request: new Request("https://begripassen.nl/api/cms/items?type=blogs&path=functions%2Fapi%2Fcms%2Flogin.js", {
        headers: { cookie: cookie.split(";")[0] },
      }),
      env: { ...authEnv, GITHUB_OWNER: "owner", GITHUB_REPO: "repo", GITHUB_TOKEN: "token" },
    });
    assert.equal(response.status, 400);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("opslaan gebruikt revisies en schrijft elk inhoudstype via een atomaire commit", async () => {
  const cookie = await createSessionCookie(authEnv.CMS_SESSION_SECRET, "https://begripassen.nl/admin/");
  const cookiePair = cookie.split(";")[0];
  const session = await getSession(new Request("https://begripassen.nl/api/cms/session", { headers: { cookie: cookiePair } }), authEnv);
  const repoEnv = {
    ...authEnv,
    GITHUB_OWNER: "owner",
    GITHUB_REPO: "repo",
    GITHUB_BRANCH: "main",
    GITHUB_TOKEN: "alleen-een-testtoken",
  };
  const originalFetch = globalThis.fetch;
  let currentCase;
  let blobNumber = 0;
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes("/contents/")) {
      if (currentCase.existing) {
        return jsonResponse({
          sha: currentCase.sha,
          path: currentCase.path,
          name: "index.md",
          content: Buffer.from(currentCase.content).toString("base64"),
        });
      }
      return jsonResponse({ message: "Not Found" }, 404);
    }
    if (target.includes("/git/ref/heads/")) return jsonResponse({ object: { sha: "head-sha" } });
    if (target.endsWith("/git/commits/head-sha")) return jsonResponse({ tree: { sha: "tree-sha" } });
    if (target.endsWith("/git/blobs")) {
      blobNumber += 1;
      return jsonResponse({ sha: `blob-${blobNumber}` });
    }
    if (target.endsWith("/git/trees")) return jsonResponse({ sha: "new-tree" });
    if (target.endsWith("/git/commits")) return jsonResponse({ sha: "new-commit" });
    if (target.includes("/git/refs/heads/")) return jsonResponse({ object: { sha: "new-commit" } });
    throw new Error(`Onverwachte mock-URL: ${target} (${options.method || "GET"})`);
  };

  const cases = [
    {
      type: "home",
      path: "content/_index.md",
      sha: "home-revision",
      existing: true,
      content: "+++\ntitle = \"Home Pagina\"\nheading = \"Oud\"\n+++\n",
      fields: {
        title: "Home Pagina", heading: "Samen maken we Assen mooier.", about: "Wij zijn BEGR!P.",
        about_image: "", about_image_alt: "Over BEGR!P", about_link_text: "", about_link_url: "",
        blog: "Bestaande ongebruikte tekst blijft bewaard.", newsletter: "Blijf op de hoogte.", support: "Help ons mee.",
        support_primary_text: "", support_primary_url: "", support_secondary_text: "", support_secondary_url: "",
        contact: "Neem contact op.", contact_phone_label: "", contact_phone: "", contact_email_label: "",
        contact_email: "", contact_instagram_label: "", contact_instagram_handle: "", contact_instagram_url: "",
      },
      body: "",
    },
    {
      type: "events",
      path: "",
      sha: "",
      existing: false,
      fields: {
        title: "Zomeravond", date: "2026-09-01T20:00", location: "Assen", organiser: "BEGR!P",
        image: "", image_alt: "", show_signup: false, signup_link: "", draft: true, summary: "Samen de zomer vieren.",
      },
      body: "Welkom op onze **zomeravond**.",
    },
    {
      type: "blogs",
      path: "",
      sha: "",
      existing: false,
      fields: {
        title: "Nieuws uit Assen", date: "2026-08-22", author: "BEGR!P", image: "", image_alt: "",
        draft: false, summary: "Een korte update uit Assen.",
      },
      body: "Dit is onze nieuwe update.",
    },
  ];

  try {
    for (const scenario of cases) {
      currentCase = scenario;
      blobNumber = 0;
      const response = await saveItem({
        request: new Request("https://begripassen.nl/api/cms/save", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: cookiePair,
            origin: "https://begripassen.nl",
            "sec-fetch-site": "same-origin",
            "x-cms-csrf": session.csrfToken,
          },
          body: JSON.stringify({
            type: scenario.type,
            path: scenario.path,
            sha: scenario.sha,
            fields: scenario.fields,
            body: scenario.body,
            uploads: [],
          }),
        }),
        env: repoEnv,
      });
      assert.equal(response.status, 200, `${scenario.type} kon niet worden opgeslagen: ${await response.clone().text()}`);
      const payload = await response.json();
      assert.match(payload.sha, /^blob-/);
      assert.equal(payload.status, scenario.fields.draft ? "draft" : "published");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("frontendmodellen beginnen veilig als concept en geven gewone veldfouten", () => {
  const event = createEmptyItem("events");
  assert.equal(event.fields.draft, true);
  const errors = validateItem("events", event.fields, "");
  assert.ok(errors.title);
  assert.ok(errors.body);
  const normalized = normalizeFields("events", { ...event.fields, title: "Test", date: "2026-09-01T20:00" });
  assert.equal(normalized.date, "2026-09-01T20:00:00.000+02:00");
});
