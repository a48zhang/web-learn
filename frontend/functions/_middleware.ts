type CFContext = EventContext<Env, string, unknown>;

const securityHeaders: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export async function onRequest(context: CFContext) {
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(securityHeaders)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}
