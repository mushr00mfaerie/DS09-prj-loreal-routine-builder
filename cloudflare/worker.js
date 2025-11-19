/* Simple Cloudflare Worker to proxy OpenAI requests so the API key is not exposed in the browser.
   - Bind your OpenAI API key as a secret named OPENAI_API_KEY in Cloudflare (wrangler secret or dashboard).
   - The frontend should POST JSON: { messages: [...], model?: "gpt-4o" }
   - This worker forwards the request to OpenAI and returns the response JSON.
   - Beginner-friendly: uses async/await and fetch, no external libs.
*/

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign(
      { "Content-Type": "application/json" },
      CORS_HEADERS
    ),
  });
}

async function handleRequest(request) {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only accept POST requests
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const messages = body.messages;
  const model = body.model || "gpt-4o";

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "Missing or invalid messages array" }, 400);
  }

  // Ensure your OPENAI_API_KEY is bound as a secret to the worker
  if (typeof OPENAI_API_KEY === "undefined" || !OPENAI_API_KEY) {
    return jsonResponse(
      { error: "Server misconfigured: OPENAI_API_KEY not set" },
      500
    );
  }

  try {
    const openaiResp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model, messages }),
      }
    );

    const data = await openaiResp.json();
    // pass through status and JSON, include CORS headers
    return new Response(JSON.stringify(data), {
      status: openaiResp.status,
      headers: Object.assign(
        { "Content-Type": "application/json" },
        CORS_HEADERS
      ),
    });
  } catch (err) {
    return jsonResponse({ error: "Request to OpenAI failed" }, 502);
  }
}
