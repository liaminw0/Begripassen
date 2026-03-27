import {
  buildContentPath,
  error,
  getCmsConfig,
  getRepoFile,
  getTypeDefinition,
  json,
  normalizeFields,
  putRepoFile,
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

  const fields = normalizeFields(type, payload.fields || {});
  const body = payload.body || "";
  const path = buildContentPath(type, fields, payload.path);
  const isUpdate = Boolean(payload.path && payload.sha);

  try {
    let sha = payload.sha || "";

    if (isUpdate && !sha) {
      const existing = await getRepoFile(config, path);
      sha = existing.sha;
    }

    const markdown = serializeMarkdownFile(fields, body);
    const singular = type.endsWith("s") ? type.slice(0, -1) : type;
    const actionLabel = isUpdate ? "Update" : "Create";
    const commitTitle = fields.title || "homepage copy";
    const response = await putRepoFile(
      config,
      path,
      markdown,
      `${actionLabel} ${singular}: ${commitTitle}`,
      sha || undefined
    );

    return json({
      ok: true,
      path,
      sha: response.content?.sha || "",
    });
  } catch (err) {
    return error(err.message, 500);
  }
}
