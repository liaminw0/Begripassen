import { createSessionCookie, error, getCmsConfig, json } from "./_lib";

export async function onRequestPost(context) {
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

  if (!payload.password) {
    return error("Password is required");
  }

  if (payload.password !== config.password) {
    return error("Incorrect password", 401);
  }

  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": await createSessionCookie(config.sessionSecret, context.request.url),
      },
    }
  );
}
