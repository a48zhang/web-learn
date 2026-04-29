type CFContext = EventContext<Env, string, unknown>;

export async function onRequest(context: CFContext) {
  const { request, env } = context;
  const backendUrl = env.BACKEND_URL;

  if (!backendUrl) {
    return new Response("BACKEND_URL not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, backendUrl);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", url.host);

  const init: RequestInit = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
  };

  return fetch(new Request(target.toString(), init));
}
