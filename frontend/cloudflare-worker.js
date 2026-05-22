// cloudflare-worker.js
// Production-grade, secure, and always-free Cloudflare Worker caching layer for Telebase.
//
// How to deploy to Cloudflare (Free Tier: 100k requests/day):
// 1. Create a KV Namespace named `TELEBASE_KV`.
// 2. Bind the KV Namespace in your Worker settings with the variable name `TELEBASE_KV`.
// 3. Set the environment variable `WORKER_KEY` to a secure, random string (this will be your CLOUDFLARE_WORKER_KEY).
// 4. Deploy this script to your Cloudflare Worker.

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-worker-key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 2. Validate Worker Key for Authentication
    const workerKey = request.headers.get("x-worker-key");
    const secretKey = env.WORKER_KEY;

    if (!secretKey) {
      return new Response("Worker error: WORKER_KEY environment variable is not configured on Cloudflare.", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    if (workerKey !== secretKey) {
      return new Response("Unauthorized connection", {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // 3. Parse Route Key from URL path
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // Remove leading slash

    if (!key) {
      return new Response("Missing database storage key parameter.", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const kv = env.TELEBASE_KV;
    if (!kv) {
      return new Response("Worker error: TELEBASE_KV binding is missing in Cloudflare settings.", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // 4. GET Operation
    if (request.method === "GET") {
      try {
        const val = await kv.get(key);
        if (val === null) {
          return new Response("Not found", {
            status: 404,
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        }
        return new Response(val, {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        return new Response(`KV Read Error: ${err.message}`, {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    // 5. PUT Operation
    if (request.method === "PUT") {
      try {
        const bodyText = await request.text();
        if (!bodyText) {
          return new Response("Empty request body payload.", {
            status: 400,
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        }

        await kv.put(key, bodyText);
        return new Response("OK", {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        return new Response(`KV Write Error: ${err.message}`, {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: {
        "Allow": "GET, PUT, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
