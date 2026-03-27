import { clearSessionCookie, json } from "./_lib";

export async function onRequestPost(context) {
  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": clearSessionCookie(context.request.url),
      },
    }
  );
}
