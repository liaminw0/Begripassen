import { PublicError, handleError, json, requireSession } from "./_core.js";
import {
  assertContentPath,
  getTypeDefinition,
  normalizeFields,
  parseMarkdownFile,
  publicUrlForPath,
  summarizeItem,
} from "./_content.js";
import { getRepoFile, getRepositoryConfig, listRepoDirectory } from "./_github.js";

async function readItem(config, type, path, optional = false) {
  const file = await getRepoFile(config, assertContentPath(type, path), { optional });
  if (!file) return null;
  const parsed = parseMarkdownFile(file.content);
  return {
    path: file.path,
    publicUrl: publicUrlForPath(file.path),
    sha: file.sha,
    fields: normalizeFields(type, parsed.fields),
    body: parsed.body,
    type,
  };
}

export async function onRequestGet(context) {
  try {
    await requireSession(context);
    const { searchParams } = new URL(context.request.url);
    const type = searchParams.get("type") || "";
    const requestedPath = searchParams.get("path") || "";
    const definition = getTypeDefinition(type);
    if (!definition) throw new PublicError("Onbekend inhoudstype.", 400, "unknown_type");

    const config = getRepositoryConfig(context.env);
    if (requestedPath) {
      return json({ ok: true, item: await readItem(config, type, requestedPath) });
    }
    if (type === "home") {
      return json({ ok: true, item: await readItem(config, type, definition.path) });
    }

    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10) || 0);
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10) || 20));
    const entries = (await listRepoDirectory(config, definition.path))
      .filter((entry) => (entry.type === "file" && entry.name.endsWith(".md") && entry.name !== "_index.md") || entry.type === "dir")
      .sort((left, right) => String(right.path).localeCompare(String(left.path)));
    const selected = entries.slice(offset, offset + limit);
    const items = (
      await Promise.all(
        selected.map(async (entry) => {
          const path = entry.type === "file" ? entry.path : `${entry.path}/index.md`;
          const item = await readItem(config, type, path, true);
          return item ? summarizeItem(type, item.path, item.fields, item.body) : null;
        })
      )
    )
      .filter(Boolean)
      .sort((left, right) => String(right.date).localeCompare(String(left.date)));

    return json({
      ok: true,
      items,
      offset,
      limit,
      hasMore: offset + selected.length < entries.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
