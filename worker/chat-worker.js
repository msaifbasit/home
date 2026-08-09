/* ============================================================
   Optional LLM proxy for the site's chat assistant.
   ------------------------------------------------------------
   The portfolio is a static, public site, so an API key placed in
   config.js or chatbot.js would be readable by every visitor and
   scraped within minutes. This tiny Cloudflare Worker keeps the key
   server-side; the browser only ever talks to the Worker.

   Deploy (about five minutes, free tier):

     1. Get a free Groq API key at https://console.groq.com/keys
        (Groq is used here because it is genuinely fast — usually
        under a second for this size of reply.)
     2. npm install -g wrangler && wrangler login
     3. wrangler deploy worker/chat-worker.js --name msb-chat
     4. wrangler secret put GROQ_API_KEY   # paste the key when asked
     5. Put the deployed URL into config.js:
          chat: { apiUrl: "https://msb-chat.<your-subdomain>.workers.dev" }

   Leave chat.apiUrl empty and the site keeps using its built-in
   answer engine, which needs none of this.
   ============================================================ */

const ALLOWED_ORIGINS = [
  "https://msaifbasit.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const MODEL = "llama-3.3-70b-versatile";
const MAX_MESSAGES = 12;
const MAX_CHARS = 4000;

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = { ...cors(origin), "Content-Type": "application/json" };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid JSON" }), { status: 400, headers });
    }

    // Only pass through what we expect, and cap it — this endpoint is public,
    // so it should never forward arbitrary payloads or unbounded text.
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && typeof m.content === "string" &&
                     ["system", "user", "assistant"].includes(m.role))
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

    if (!messages.length) {
      return new Response(JSON.stringify({ error: "no messages" }), { status: 400, headers });
    }

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 400,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("groq error", upstream.status, detail.slice(0, 300));
      // The widget falls back to its built-in engine on any non-200.
      return new Response(JSON.stringify({ error: "upstream" }), { status: 502, headers });
    }

    const data = await upstream.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    return new Response(JSON.stringify({ reply }), { headers });
  },
};
