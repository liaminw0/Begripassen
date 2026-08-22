import { PublicError, handleError, json, readJson, requireSession } from "./_core.js";
import { assertContentPath, getTypeDefinition } from "./_content.js";
import {
  commitRepoChanges,
  getRepoFile,
  getRepositoryConfig,
  listRepoFilesRecursive,
} from "./_github.js";

export async function onRequestPost(context) {
  try {
    await requireSession(context, { mutation: true });
    const payload = await readJson(context.request, 16 * 1024);
    const type = String(payload.type || "");
    if (!getTypeDefinition(type)) throw new PublicError("Onbekend inhoudstype.", 400, "unknown_type");
    if (type === "home" || type === "about") throw new PublicError("Deze vaste pagina kan niet worden verwijderd.", 400, "delete_forbidden");

    const path = assertContentPath(type, String(payload.path || ""));
    const config = getRepositoryConfig(context.env);
    const existing = await getRepoFile(config, path, { optional: true });
    if (!existing) throw new PublicError("Deze inhoud bestaat niet meer.", 404, "not_found");
    if (!payload.sha || payload.sha !== existing.sha) {
      throw new PublicError(
        "Deze inhoud is ondertussen gewijzigd. Vernieuw het overzicht en probeer opnieuw.",
        409,
        "revision_conflict"
      );
    }

    const deletes = path.endsWith("/index.md")
      ? await listRepoFilesRecursive(config, path.replace(/\/index\.md$/, ""))
      : [path];
    await commitRepoChanges(config, {
      deletes,
      message: `Verwijder ${type === "events" ? "evenement" : "blog"}`,
    });
    return json({ ok: true, path });
  } catch (err) {
    return handleError(err);
  }
}
