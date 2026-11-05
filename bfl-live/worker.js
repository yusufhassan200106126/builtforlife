/* Built For Life on Cloudflare Workers.
   /api/... goes to the server code; everything else is the website in /site. */
import { onRequest } from "./functions/api/[[route]].js";

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/")) {
      return onRequest({ request, env, params: {}, waitUntil: p => ctx.waitUntil(p) });
    }
    return env.ASSETS.fetch(request);
  }
};
