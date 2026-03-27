import {
  buildContentPath,
  buildUploadTarget,
  error,
  getCmsConfig,
  json,
  putRepoFileBase64,
  requireAuth,
} from "./_lib";

export async function onRequestPost(context) {
  const unauthorized = await requireAuth(context);
  if (unauthorized) {
    return unauthorized;
  }

  let config;
  try {
    config = getCmsConfig(context.env);
  } catch (err) {
    return error(err.message, 500);
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return error("Invalid JSON body");
  }

  if (!payload.filename || !payload.base64 || !payload.mimeType) {
    return error("filename, mimeType and base64 are required");
  }

  try {
    const cmsType = payload.type || "";
    const fields = payload.fields || {};
    const currentPath = buildContentPath(cmsType, fields, payload.path || "");
    const target = buildUploadTarget(cmsType, currentPath, payload.filename, payload.mimeType);
    const filepath = target.filepath;
    const fieldPath = target.fieldPath;
    const previewUrl =
      (cmsType === "events" || cmsType === "blogs") && fieldPath.startsWith("media/")
        ? `/${currentPath.replace(/^content\//, "").replace(/\/index\.md$/, "")}/${fieldPath}`
        : fieldPath;
    const itemPath = (cmsType === "events" || cmsType === "blogs") ? currentPath : "";

    const message = `Upload image: ${payload.filename}`;
    await putRepoFileBase64(config, filepath, payload.base64, message);

    return json({
      ok: true,
      path: fieldPath,
      previewUrl,
      itemPath,
    });
  } catch (err) {
    return error(err.message, 500);
  }
}
