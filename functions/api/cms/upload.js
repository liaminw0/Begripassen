import { error, getCmsConfig, json, putRepoFileBase64, requireAuth, slugify } from "./_lib";

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function sanitizeFilename(filename, mimeType) {
  const cleanBase = slugify(filename.replace(/\.[^/.]+$/, "")) || "upload";
  const extension = MIME_EXTENSIONS[mimeType] || filename.split(".").pop().toLowerCase() || "bin";
  return `${cleanBase}.${extension}`;
}

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
    const filepath = `static/images/uploads/${Date.now()}-${sanitizeFilename(payload.filename, payload.mimeType)}`;
    const message = `Upload image: ${payload.filename}`;
    await putRepoFileBase64(config, filepath, payload.base64, message);

    return json({
      ok: true,
      path: `/${filepath.replace(/^static\//, "")}`,
    });
  } catch (err) {
    return error(err.message, 500);
  }
}
