export interface Env {
  ASSETS: Fetcher;
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return proxyToBackend(request, env);
    }

    const response = await env.ASSETS.fetch(request);

    // SPA fallback: 404 → index.html
    if (response.status === 404) {
      const indexRequest = new Request(new URL("/", url), request);
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      return withSecurityHeaders(indexResponse);
    }

    return withSecurityHeaders(response);
  },
};

async function proxyToBackend(request: Request, env: Env): Promise<Response> {
  const backendUrl = env.BACKEND_URL;
  if (!backendUrl) {
    return new Response("BACKEND_URL not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, backendUrl);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", url.host);

  return fetch(
    new Request(target.toString(), {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
    })
  );
}

function withSecurityHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  newResponse.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  return newResponse;
}
