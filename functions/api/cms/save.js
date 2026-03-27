import {
  batchCommitRepoFiles,
  buildUploadTarget,
  buildContentPath,
  encodeContentBase64,
  error,
  getCmsConfig,
  getTypeDefinition,
  json,
  normalizeFields,
  requireAuth,
  serializeMarkdownFile,
} from "./_lib";

export async function onRequestPost(context) {
  const unauthorized = await requireAuth(context);
  if (unauthorized) {
    return unauthorized;
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const type = payload.type;
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

  const rawFields = { ...(payload.fields || {}) };
  const uploads = Array.isArray(payload.uploads) ? payload.uploads : [];
  const savedAt = new Date().toISOString();

  try {
    const provisionalFields = normalizeFields(type, rawFields);
    const path = buildContentPath(type, provisionalFields, payload.path);
    const uploadFiles = [];
    const replacements = new Map();

    for (const upload of uploads) {
      if (!upload?.token || !upload?.base64 || !upload?.filename || !upload?.mimeType) {
        continue;
      }

      const target = buildUploadTarget(type, path, upload.filename, upload.mimeType);
      replacements.set(upload.token, target.fieldPath);
      uploadFiles.push({
        path: target.filepath,
        contentBase64: upload.base64,
      });
    }

    for (const [key, value] of Object.entries(rawFields)) {
      if (typeof value !== "string") {
        continue;
      }

      let nextValue = value;
      for (const [token, replacement] of replacements.entries()) {
        nextValue = nextValue.split(token).join(replacement);
      }
      rawFields[key] = nextValue;
    }

    if (type === "events" || type === "blogs") {
      rawFields.cms_updated_at = savedAt;
    }

    let body = String(payload.body || "");
    for (const [token, replacement] of replacements.entries()) {
      body = body.split(token).join(replacement);
    }

    const fields = normalizeFields(type, rawFields);
    const markdown = serializeMarkdownFile(fields, body);
    const singular = type.endsWith("s") ? type.slice(0, -1) : type;
    const actionLabel = payload.path ? "Update" : "Create";
    const commitTitle = fields.title || "homepage copy";
    const response = await batchCommitRepoFiles(config, [
      ...uploadFiles,
      {
        path,
        contentBase64: encodeContentBase64(markdown),
      },
    ], `${actionLabel} ${singular}: ${commitTitle}`);

    return json({
      ok: true,
      path,
      sha: response.sha || "",
      cms_updated_at: savedAt,
    });
  } catch (err) {
    return error(err.message, 500);
  }
}
