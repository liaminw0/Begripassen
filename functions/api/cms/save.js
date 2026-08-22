import { PublicError, handleError, json, readJson, requireSession } from "./_core.js";
import {
  assertContentPath,
  buildContentPath,
  buildUploadTarget,
  getTypeDefinition,
  mergePreservedFields,
  normalizeFields,
  parseMarkdownFile,
  publicUrlForPath,
  serializeMarkdownFile,
  serializeTomlMarkdownFile,
  validateContent,
  validateUpload,
} from "./_content.js";
import {
  commitRepoChanges,
  encodeContentBase64,
  getRepoFile,
  getRepositoryConfig,
} from "./_github.js";

const MAX_UPLOADS = 8;
const MAX_TOTAL_UPLOAD_BYTES = 18 * 1024 * 1024;

function replaceToken(value, token, replacement) {
  return typeof value === "string" ? value.split(token).join(replacement) : value;
}

export async function onRequestPost(context) {
  try {
    await requireSession(context, { mutation: true });
    const payload = await readJson(context.request);
    const type = String(payload.type || "");
    if (!getTypeDefinition(type)) throw new PublicError("Onbekend inhoudstype.", 400, "unknown_type");

    const rawFields = payload.fields && typeof payload.fields === "object" && !Array.isArray(payload.fields)
      ? { ...payload.fields }
      : {};
    let body = String(payload.body || "");
    const currentPath = payload.path ? assertContentPath(type, String(payload.path)) : "";
    const provisionalFields = normalizeFields(type, rawFields);
    const path = buildContentPath(type, provisionalFields, currentPath);
    const config = getRepositoryConfig(context.env);

    const existing = await getRepoFile(config, path, { optional: true });
    const isEdit = type === "home" || type === "about" || Boolean(currentPath);
    if (!isEdit && existing) {
      throw new PublicError(
        "Er bestaat al inhoud met deze datum en titel. Pas de titel aan en probeer opnieuw.",
        409,
        "duplicate_slug",
        { fields: { title: "Deze titel bestaat op deze datum al." } }
      );
    }
    if (isEdit) {
      if (!existing) throw new PublicError("Deze inhoud bestaat niet meer. Ga terug naar het overzicht.", 404, "not_found");
      if (!payload.sha || payload.sha !== existing.sha) {
        throw new PublicError(
          "Deze inhoud is ondertussen door iemand anders gewijzigd. Vernieuw de pagina voordat je verdergaat.",
          409,
          "revision_conflict"
        );
      }
    }

    const rawUploads = Array.isArray(payload.uploads) ? payload.uploads : [];
    if (rawUploads.length > MAX_UPLOADS) throw new PublicError("Voeg maximaal 8 afbeeldingen tegelijk toe.", 413, "too_many_images");
    const uploads = rawUploads.map(validateUpload);
    if (uploads.reduce((total, upload) => total + upload.byteLength, 0) > MAX_TOTAL_UPLOAD_BYTES) {
      throw new PublicError("De afbeeldingen zijn samen te groot.", 413, "images_too_large");
    }

    const uploadWrites = [];
    const seenTokens = new Set();
    for (const upload of uploads) {
      if (seenTokens.has(upload.token)) throw new PublicError("Een afbeelding komt dubbel voor.", 422, "invalid_image");
      seenTokens.add(upload.token);
      const combinedContent = `${Object.values(rawFields).filter((value) => typeof value === "string").join("\n")}\n${body}`;
      if (!combinedContent.includes(upload.token)) throw new PublicError("Een afbeelding wordt nergens gebruikt.", 422, "invalid_image");
      const target = buildUploadTarget(type, path, upload.filename, upload.mimeType);
      for (const [key, value] of Object.entries(rawFields)) rawFields[key] = replaceToken(value, upload.token, target.fieldPath);
      body = replaceToken(body, upload.token, target.fieldPath);
      uploadWrites.push({ path: target.filepath, contentBase64: upload.base64 });
    }

    if (/__CMS_UPLOAD_[a-f0-9-]+__/.test(`${JSON.stringify(rawFields)}${body}`)) {
      throw new PublicError("Een afbeelding is nog niet klaar om op te slaan.", 422, "pending_image");
    }

    const validated = validateContent(type, rawFields, body);
    const existingFields = existing ? parseMarkdownFile(existing.content).fields : {};
    const serializedFields = mergePreservedFields(type, existingFields, validated.fields);
    const markdown = type === "home"
      ? serializeTomlMarkdownFile(serializedFields, validated.body)
      : serializeMarkdownFile(serializedFields, validated.body);
    const result = await commitRepoChanges(config, {
      writes: [...uploadWrites, { path, contentBase64: encodeContentBase64(markdown) }],
      message: `${validated.fields.draft ? "Bewaar concept" : "Publiceer"} ${type === "home" ? "homepagina" : type === "about" ? "over-ons-pagina" : type === "events" ? "evenement" : "blog"}: ${validated.fields.title || "Home Pagina"}`,
    });

    return json({
      ok: true,
      path,
      publicUrl: publicUrlForPath(path),
      sha: result.revisions[path],
      fields: validated.fields,
      body: validated.body,
      status: validated.fields.draft ? "draft" : "published",
    });
  } catch (err) {
    return handleError(err);
  }
}
