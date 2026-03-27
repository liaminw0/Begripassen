import {
  error,
  getCmsConfig,
  getRepoFile,
  getTypeDefinition,
  json,
  listRepoDirectory,
  normalizeFields,
  parseMarkdownFile,
  requireAuth,
  summarizeItem,
} from "./_lib";

async function loadItemFromEntry(config, type, entryPath) {
  const file = await getRepoFile(config, entryPath);
  const parsed = parseMarkdownFile(file.content);
  return summarizeItem(type, file.path, normalizeFields(type, parsed.fields), parsed.body);
}

function compareEntriesByPathDesc(a, b) {
  return String(b.path || "").localeCompare(String(a.path || ""));
}

export async function onRequestGet(context) {
  const unauthorized = await requireAuth(context);
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(context.request.url);
  const type = searchParams.get("type");
  const path = searchParams.get("path");
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10) || 20));
  const definition = getTypeDefinition(type);

  if (!definition) {
    return error("Unknown content type");
  }

  let config;
  try {
    config = getCmsConfig(context.env);
  } catch (err) {
    return error(err.message, 500);
  }

  try {
    if (path) {
      const file = await getRepoFile(config, path);
      const parsed = parseMarkdownFile(file.content);
      return json({
        ok: true,
        item: {
          path: file.path,
          sha: file.sha,
          fields: normalizeFields(type, parsed.fields),
          body: parsed.body,
          type,
        },
      });
    }

    if (type === "home") {
      const file = await getRepoFile(config, definition.path);
      const parsed = parseMarkdownFile(file.content);
      return json({
        ok: true,
        item: {
          path: file.path,
          sha: file.sha,
          fields: normalizeFields(type, parsed.fields),
          body: parsed.body,
          type,
        },
      });
    }

    const entries = await listRepoDirectory(config, definition.path);
    const eligibleEntries = entries
      .filter((entry) => {
        if (entry.type === "file") {
          return entry.name.endsWith(".md") && entry.name !== "_index.md";
        }

        return entry.type === "dir";
      })
      .sort(compareEntriesByPathDesc);

    const selectedEntries = eligibleEntries.slice(offset, offset + limit);
    const itemPromises = selectedEntries.map(async (entry) => {
      if (entry.type === "file") {
        return loadItemFromEntry(config, type, entry.path);
      }

      try {
        return await loadItemFromEntry(config, type, `${entry.path}/index.md`);
      } catch {
        return null;
      }
    });

    const items = (await Promise.all(itemPromises))
      .filter(Boolean)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return json({
      ok: true,
      items,
      offset,
      limit,
      hasMore: offset + selectedEntries.length < eligibleEntries.length,
    });
  } catch (err) {
    return error(err.message, 500);
  }
}
