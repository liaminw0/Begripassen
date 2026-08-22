import { PublicError } from "./_core.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class GitHubError extends Error {
  constructor(status) {
    super(`GitHub API request failed (${status})`);
    this.name = "GitHubError";
    this.status = status;
  }
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

export function getRepositoryConfig(env) {
  return {
    owner: requiredEnv(env, "GITHUB_OWNER"),
    repo: requiredEnv(env, "GITHUB_REPO"),
    branch: env.GITHUB_BRANCH || "main",
    token: requiredEnv(env, "GITHUB_TOKEN"),
    committerName: env.GITHUB_COMMITTER_NAME || "",
    committerEmail: env.GITHUB_COMMITTER_EMAIL || "",
  };
}

function encodeRepoPath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

async function githubRequest(config, path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("accept", "application/vnd.github+json");
  headers.set("authorization", `Bearer ${config.token}`);
  headers.set("user-agent", "begrip-cms");
  headers.set("x-github-api-version", "2022-11-28");

  const response = await fetch(`https://api.github.com${path}`, { ...init, headers });
  if (!response.ok) {
    throw new GitHubError(response.status);
  }
  return response;
}

async function githubJson(config, path, init = {}) {
  return (await githubRequest(config, path, init)).json();
}

export async function listRepoDirectory(config, path) {
  return githubJson(
    config,
    `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(config.branch)}`
  );
}

export async function getRepoFile(config, path, { optional = false } = {}) {
  try {
    const data = await githubJson(
      config,
      `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(config.branch)}`
    );
    const content = data.content
      ? decoder.decode(
          Uint8Array.from(atob(data.content.replace(/\n/g, "")), (character) => character.charCodeAt(0))
        )
      : "";
    return { sha: data.sha, content, path: data.path, name: data.name };
  } catch (err) {
    if (optional && err instanceof GitHubError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function listRepoFilesRecursive(config, path, depth = 0) {
  if (depth > 4) {
    throw new PublicError("Deze mapstructuur is te diep om veilig te verwijderen.", 400, "invalid_path");
  }

  const entries = await listRepoDirectory(config, path);
  const files = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      files.push(entry.path);
    } else if (entry.type === "dir") {
      files.push(...(await listRepoFilesRecursive(config, entry.path, depth + 1)));
    }
  }
  return files;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function encodeContentBase64(content) {
  return bytesToBase64(encoder.encode(content));
}

function authorFor(config) {
  if (!config.committerName || !config.committerEmail) {
    return {};
  }
  return {
    author: { name: config.committerName, email: config.committerEmail },
    committer: { name: config.committerName, email: config.committerEmail },
  };
}

export async function commitRepoChanges(config, { writes = [], deletes = [], message }) {
  if (!writes.length && !deletes.length) {
    throw new PublicError("Er zijn geen wijzigingen om op te slaan.", 400, "empty_change");
  }

  const repoBase = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  const ref = await githubJson(
    config,
    `${repoBase}/git/ref/heads/${encodeURIComponent(config.branch)}`
  );
  const headCommitSha = ref.object?.sha;
  const headCommit = await githubJson(config, `${repoBase}/git/commits/${headCommitSha}`);
  const baseTreeSha = headCommit.tree?.sha;
  if (!headCommitSha || !baseTreeSha) {
    throw new Error("Repository branch could not be resolved");
  }

  const uniqueWrites = new Map();
  for (const write of writes) {
    if (write?.path && write?.contentBase64) {
      uniqueWrites.set(write.path, write.contentBase64);
    }
  }

  const tree = [];
  const revisions = {};
  for (const [path, contentBase64] of uniqueWrites.entries()) {
    const blob = await githubJson(config, `${repoBase}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: contentBase64, encoding: "base64" }),
    });
    revisions[path] = blob.sha;
    tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }

  for (const path of new Set(deletes)) {
    if (!uniqueWrites.has(path)) {
      tree.push({ path, mode: "100644", type: "blob", sha: null });
    }
  }

  const createdTree = await githubJson(config, `${repoBase}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  const createdCommit = await githubJson(config, `${repoBase}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: createdTree.sha,
      parents: [headCommitSha],
      ...authorFor(config),
    }),
  });

  try {
    await githubJson(
      config,
      `${repoBase}/git/refs/heads/${encodeURIComponent(config.branch)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ sha: createdCommit.sha, force: false }),
      }
    );
  } catch (err) {
    if (err instanceof GitHubError && [409, 422].includes(err.status)) {
      throw new PublicError(
        "Iemand anders heeft zojuist ook iets opgeslagen. Vernieuw de inhoud en probeer opnieuw.",
        409,
        "revision_conflict"
      );
    }
    throw err;
  }

  return { commitSha: createdCommit.sha, revisions };
}
