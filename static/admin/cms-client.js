export class CmsApiError extends Error {
  constructor(message, { status = 0, code = "request_failed", details = {} } = {}) {
    super(message);
    this.name = "CmsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class CmsClient {
  constructor() {
    this.csrfToken = "";
  }

  setSession(session) {
    this.csrfToken = session?.csrfToken || "";
  }

  async request(path, { method = "GET", body, signal, authenticatedMutation = false } = {}) {
    const headers = new Headers();
    const options = { method, credentials: "same-origin", headers, signal };
    if (body !== undefined) {
      headers.set("content-type", "application/json");
      options.body = JSON.stringify(body);
    }
    if (authenticatedMutation) headers.set("x-cms-csrf", this.csrfToken);

    let response;
    try {
      response = await fetch(path, options);
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      throw new CmsApiError("Er is geen verbinding. Controleer je internet en probeer opnieuw.", { code: "network_error" });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new CmsApiError(payload.error || "Het verzoek kon niet worden uitgevoerd.", {
        status: response.status,
        code: payload.code,
        details: payload.details,
      });
    }
    return payload;
  }

  session(signal) {
    return this.request("/api/cms/session", { signal });
  }

  login(password) {
    return this.request("/api/cms/login", { method: "POST", body: { password } });
  }

  logout() {
    return this.request("/api/cms/logout", { method: "POST", body: {}, authenticatedMutation: true });
  }

  list(type, { offset = 0, limit = 20, signal } = {}) {
    return this.request(`/api/cms/items?type=${encodeURIComponent(type)}&offset=${offset}&limit=${limit}`, { signal });
  }

  item(type, path = "", signal) {
    const query = path
      ? `type=${encodeURIComponent(type)}&path=${encodeURIComponent(path)}`
      : `type=${encodeURIComponent(type)}`;
    return this.request(`/api/cms/items?${query}`, { signal });
  }

  save(payload) {
    return this.request("/api/cms/save", { method: "POST", body: payload, authenticatedMutation: true });
  }

  delete(payload) {
    return this.request("/api/cms/delete", { method: "POST", body: payload, authenticatedMutation: true });
  }
}

export const cmsClient = new CmsClient();
