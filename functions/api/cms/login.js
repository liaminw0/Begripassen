import {
  PublicError,
  assertSameOrigin,
  constantTimeEqual,
  createSessionCookie,
  getAuthConfig,
  handleError,
  json,
  readJson,
} from "./_core.js";

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    const config = getAuthConfig(context.env);
    const payload = await readJson(context.request, 4 * 1024);
    const password = typeof payload.password === "string" ? payload.password : "";

    if (!password || password.length > 512 || !(await constantTimeEqual(password, config.password))) {
      throw new PublicError("Het wachtwoord klopt niet.", 401, "invalid_credentials");
    }

    return json(
      { ok: true },
      { headers: { "set-cookie": await createSessionCookie(config.sessionSecret, context.request.url) } }
    );
  } catch (err) {
    return handleError(err);
  }
}
