import { deleteRepoFile, error, getCmsConfig, getRepoFile, getTypeDefinition, json, requireAuth } from "./_lib";

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
  const path = payload.path;
  const definition = getTypeDefinition(type);

  if (!definition || !path) {
    return error("type and path are required");
  }

  if (type === "home") {
    return error("Homepage content cannot be deleted");
  }

  let config;
  try {
    config = getCmsConfig(context.env);
  } catch (err) {
    return error(err.message, 500);
  }

  try {
    let sha = payload.sha || "";
    if (!sha) {
      const existing = await getRepoFile(config, path);
      sha = existing.sha;
    }

    await deleteRepoFile(config, path, `Delete ${type.slice(0, -1)}: ${path.split("/").pop()}`, sha);

    return json({
      ok: true,
      path,
    });
  } catch (err) {
    return error(err.message, 500);
  }
}
