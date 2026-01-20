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
      CORS_HEADERS,
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
  // Default to Mistral's model instead of OpenAI's
  const model = body.model || "mistral-large-latest";

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "Missing or invalid messages array" }, 400);
  }

  // Ensure your OPENAI_API_KEY is bound as a secret to the worker
  // Note: The secret is named OPENAI_API_KEY but contains your Mistral API key
  if (typeof OPENAI_API_KEY === "undefined" || !OPENAI_API_KEY) {
    return jsonResponse(
      { error: "Server misconfigured: OPENAI_API_KEY not set" },
      500,
    );
  }

  try {
    // Use Mistral AI's API endpoint instead of OpenAI's
    const openaiResp = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model, messages }),
      },
    );

    const data = await openaiResp.json();
    // pass through status and JSON, include CORS headers
    return new Response(JSON.stringify(data), {
      status: openaiResp.status,
      headers: Object.assign(
        { "Content-Type": "application/json" },
        CORS_HEADERS,
      ),
    });
  } catch (err) {
    return jsonResponse({ error: "Request to Mistral AI failed" }, 502);
  }
}
