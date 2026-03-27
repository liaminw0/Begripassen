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

export async function onRequestGet(context) {
  const unauthorized = await requireAuth(context);
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(context.request.url);
  const type = searchParams.get("type");
  const path = searchParams.get("path");
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
    const itemPromises = entries.map(async (entry) => {
      if (entry.type === "file" && entry.name.endsWith(".md")) {
        return loadItemFromEntry(config, type, entry.path);
      }

      if (entry.type === "dir") {
        try {
          return await loadItemFromEntry(config, type, `${entry.path}/index.md`);
        } catch {
          return null;
        }
      }

      return null;
    });

    const items = (await Promise.all(itemPromises)).filter(Boolean);

    items.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return json({
      ok: true,
      items,
    });
  } catch (err) {
    return error(err.message, 500);
  }
}
