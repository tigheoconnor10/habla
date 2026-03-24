import { fetchFeeds } from "./feeds.js";
import { lookupPhrase } from "./analyze.js";
import { getHTML } from "./app.html.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GET /feeds?sources=bbc,elpais
    if (url.pathname === "/feeds") {
      const sources = (url.searchParams.get("sources") || "bbc,elpais").split(",");
      try {
        const items = await fetchFeeds(sources);
        return Response.json({ ok: true, items });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    // POST /lookup  { phrase, context }
    if (url.pathname === "/lookup" && request.method === "POST") {
      try {
        const { phrase, context } = await request.json();
        const result = await lookupPhrase(phrase, context, env.ANTHROPIC_API_KEY);
        return Response.json({ ok: true, result });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    // GET / — serve the app
    return new Response(getHTML(), {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  },
};
