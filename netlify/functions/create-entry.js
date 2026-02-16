const GITHUB_API_BASE = "https://api.github.com";

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDateYYYYMMDD(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function toFrontmatterValue(value) {
  const str = String(value);
  if (/^[a-zA-Z0-9_./:@+\- ]+$/.test(str) && !str.includes(":")) {
    return str;
  }
  return JSON.stringify(str);
}

function buildBlogMarkdown(payload) {
  const lines = [
    "---",
    `title: ${toFrontmatterValue(payload.title)}`,
    `date: ${toFrontmatterValue(payload.date)}`,
    `author: ${toFrontmatterValue(payload.author)}`,
  ];

  if (payload.image) {
    lines.push(`image: ${toFrontmatterValue(payload.image)}`);
  }

  lines.push("---", payload.body || "");
  return `${lines.join("\n")}\n`;
}

function buildEventMarkdown(payload) {
  const lines = [
    "---",
    `title: ${toFrontmatterValue(payload.title)}`,
    `date: ${toFrontmatterValue(payload.date)}`,
    `author: ${toFrontmatterValue(payload.author)}`,
    `publishdate: ${toFrontmatterValue(payload.publishdate || "2023-03-18")}`,
  ];

  if (payload.location) lines.push(`location: ${toFrontmatterValue(payload.location)}`);
  if (payload.time) lines.push(`time: ${toFrontmatterValue(payload.time)}`);
  if (payload.organiser) lines.push(`organiser: ${toFrontmatterValue(payload.organiser)}`);
  if (payload.image) lines.push(`image: ${toFrontmatterValue(payload.image)}`);
  if (typeof payload.show_signup === "boolean") {
    lines.push(`show_signup: ${payload.show_signup ? "true" : "false"}`);
  }
  if (payload.signup_link) lines.push(`signup_link: ${toFrontmatterValue(payload.signup_link)}`);

  lines.push("---", payload.body || "");
  return `${lines.join("\n")}\n`;
}

async function createFileInRepo({ owner, repo, branch, token, path, content, message }) {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "User-Agent": "begrip-custom-admin",
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub API ${response.status}: ${details}`);
  }

  return response.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const adminKey = process.env.CUSTOM_ADMIN_KEY;
  if (!adminKey) {
    return json(500, { error: "Server misconfigured: CUSTOM_ADMIN_KEY missing" });
  }

  const requestKey = event.headers["x-admin-key"] || event.headers["X-Admin-Key"];
  if (!requestKey || requestKey !== adminKey) {
    return json(401, { error: "Unauthorized" });
  }

  const githubToken = process.env.GITHUB_CONTENTS_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;
  const githubBranch = process.env.GITHUB_BRANCH || "main";

  if (!githubToken || !githubRepo) {
    return json(500, { error: "Server misconfigured: missing GitHub env vars" });
  }

  const [owner, repo] = githubRepo.split("/");
  if (!owner || !repo) {
    return json(500, { error: "GITHUB_REPO must be in format owner/repo" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const type = payload.type;
  if (type !== "blog" && type !== "event") {
    return json(400, { error: "type must be 'blog' or 'event'" });
  }

  if (!payload.title || !payload.date || !payload.author || !payload.body) {
    return json(400, { error: "title, date, author and body are required" });
  }

  const datePrefix = formatDateYYYYMMDD(payload.date);
  if (!datePrefix) {
    return json(400, { error: "Invalid date" });
  }

  const slug = slugify(payload.slug || payload.title);
  if (!slug) {
    return json(400, { error: "Could not generate slug" });
  }

  const folder = type === "blog" ? "content/blogs" : "content/events";
  const path = `${folder}/${datePrefix}-${slug}.md`;

  const markdown = type === "blog" ? buildBlogMarkdown(payload) : buildEventMarkdown(payload);
  const message = `Create ${type}: ${payload.title}`;

  try {
    await createFileInRepo({
      owner,
      repo,
      branch: githubBranch,
      token: githubToken,
      path,
      content: markdown,
      message,
    });

    return json(200, { ok: true, path });
  } catch (err) {
    return json(500, { error: "Failed to create content file", details: err.message });
  }
};
