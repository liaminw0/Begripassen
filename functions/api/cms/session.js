import { getCmsConfig, isAuthenticated, json } from "./_lib";

export async function onRequestGet(context) {
  try {
    getCmsConfig(context.env);
  } catch (err) {
    return json(
      {
        ok: false,
        authenticated: false,
        error: err.message,
      },
      { status: 500 }
    );
  }

  return json({
    ok: true,
    authenticated: await isAuthenticated(context.request, context.env),
  });
}
