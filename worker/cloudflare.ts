import handler from "vinext/server/fetch-handler";

// Standalone Workers do not have Sites' trusted account-header gateway.
// Guest sessions remain available; do not trust caller-supplied account IDs.
export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const headers = new Headers(request.headers);
    for (const name of Array.from(headers.keys())) {
      if (name.startsWith("oai-authenticated-user-")) headers.delete(name);
    }
    const pathname = new URL(request.url).pathname;
    if (
      ["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(
        pathname,
      )
    ) {
      return new Response(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DropBy - guest profiles</title></head><body style="font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#263249;background:#f5f7fd"><h1>Your guest profile still works.</h1><p>Optional ChatGPT account linking belongs to the managed Sites host and is not configured on this independent deployment. Your nickname, rooms, and messages work through your browser session.</p><p>Keep this browser session to retain your guest identity. A separate account provider can be integrated later.</p><a href="/" style="color:#4e6bfa">Return to DropBy</a></body></html>',
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
          },
        },
      );
    }
    return handler.fetch(new Request(request, { headers }), env, ctx);
  },
};
