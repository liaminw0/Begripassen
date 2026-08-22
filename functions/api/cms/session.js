import { getSession, handleError, json } from "./_core.js";

export async function onRequestGet(context) {
  try {
    const session = await getSession(context.request, context.env);
    return json({
      ok: true,
      authenticated: Boolean(session),
      ...(session ? { csrfToken: session.csrfToken, expiresAt: session.expiresAt } : {}),
    });
  } catch (err) {
    return handleError(err);
  }
}
