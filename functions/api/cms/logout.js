import {
  assertSameOrigin,
  clearSessionCookie,
  getSession,
  handleError,
  json,
  requireSession,
} from "./_core.js";

export async function onRequestPost(context) {
  try {
    const session = await getSession(context.request, context.env);
    if (session) await requireSession(context, { mutation: true });
    else assertSameOrigin(context.request);

    return json(
      { ok: true },
      { headers: { "set-cookie": clearSessionCookie(context.request.url) } }
    );
  } catch (err) {
    return handleError(err);
  }
}
