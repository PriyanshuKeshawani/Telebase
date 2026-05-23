// cloudflare-worker.js
// Production-grade, secure, and always-free Cloudflare Worker caching layer for Telebase.
//
// How to deploy to Cloudflare (Free Tier: 100k requests/day):
// 1. Create a KV Namespace named `TELEBASE_KV`.
// 2. Bind the KV Namespace in your Worker settings with the variable name `TELEBASE_KV`.
// 3. Set the environment variable `WORKER_KEY` to a secure, random string (this will be your CLOUDFLARE_WORKER_KEY).
// 4. Deploy this script to your Cloudflare Worker.

// Robust helper to extract environment variables and KV bindings in both Module and Service Worker contexts
function getEnvVar(env, key) {
  try {
    if (typeof env !== 'undefined' && env && env[key] !== undefined) {
      return env[key];
    }
  } catch (e) {}
  try {
    if (typeof globalThis !== 'undefined' && globalThis && globalThis[key] !== undefined) {
      return globalThis[key];
    }
  } catch (e) {}
  try {
    if (typeof self !== 'undefined' && self && self[key] !== undefined) {
      return self[key];
    }
  } catch (e) {}
  return undefined;
}

async function handleFetch(request, env, ctx) {
  try {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-worker-key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    const key = url.pathname.slice(1); // Remove leading slash

    // 2. Render self-diagnostic status console on the root path `/` or `/index.html`
    if (!key || key === "" || key === "index.html") {
      const secretKey = getEnvVar(env, "WORKER_KEY");
      const kv = getEnvVar(env, "TELEBASE_KV");
      
      const isWorkerKeySet = !!secretKey;
      const isKVBound = !!kv;
      
      let isKVFunctional = false;
      let kvErrorMsg = "";
      
      if (isKVBound) {
        try {
          // Verify if KV is actually responsive and working
          await kv.get("__telebase_healthcheck__");
          isKVFunctional = true;
        } catch (err) {
          isKVFunctional = false;
          kvErrorMsg = err.message;
        }
      }

      const isHealthy = isWorkerKeySet && isKVBound && isKVFunctional;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telebase Worker Console</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Outfit', sans-serif;
      background: radial-gradient(circle at top left, #0e121a, #05070a);
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl relative overflow-hidden">
    <!-- Glow Effects -->
    <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
    <div class="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
    
    <div class="flex flex-col items-center text-center">
      <!-- Logo -->
      <div class="w-16 h-16 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      
      <h1 class="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
        Telebase Edge Worker
      </h1>
      <p class="text-sm text-slate-400 mt-2">
        High-Performance Edge Caching Layer
      </p>
      
      <!-- Status Badge -->
      <div class="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase \${isHealthy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
        \${isHealthy ? 'Active & Secure' : 'Configuration Required'}
      </div>
      
      <div class="w-full border-t border-slate-800/80 my-6"></div>
      
      <!-- Diagnostics Cards -->
      <div class="w-full space-y-4 text-left">
        <div class="bg-slate-950/40 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center \${isWorkerKeySet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
              \${isWorkerKeySet ? '✓' : '✗'}
            </div>
            <div>
              <p class="text-sm font-semibold">WORKER_KEY</p>
              <p class="text-xs text-slate-400">Environment Variable</p>
            </div>
          </div>
          <span class="text-xs font-medium px-2.5 py-1 rounded-md \${isWorkerKeySet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
            \${isWorkerKeySet ? 'Configured' : 'Missing'}
          </span>
        </div>
        
        <div class="bg-slate-950/40 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center \${isKVBound ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
              \${isKVBound ? '✓' : '✗'}
            </div>
            <div>
              <p class="text-sm font-semibold">TELEBASE_KV Binding</p>
              <p class="text-xs text-slate-400">KV Namespace Variable</p>
            </div>
          </div>
          <span class="text-xs font-medium px-2.5 py-1 rounded-md \${isKVBound ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
            \${isKVBound ? 'Bound' : 'Missing'}
          </span>
        </div>

        <div class="bg-slate-950/40 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center \${isKVFunctional ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
              \${isKVFunctional ? '✓' : '✗'}
            </div>
            <div>
              <p class="text-sm font-semibold">KV Operations</p>
              <p class="text-xs text-slate-400">Read/Write Functionality</p>
            </div>
          </div>
          <span class="text-xs font-medium px-2.5 py-1 rounded-md \${isKVFunctional ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
            \${isKVFunctional ? 'Functional' : 'Failing'}
          </span>
        </div>
      </div>
      
      <!-- Diagnostic Help Box -->
      \${!isHealthy ? `
      <div class="w-full bg-slate-950/60 border border-amber-500/10 p-4 rounded-2xl text-left mt-6">
        <p class="text-xs font-semibold text-amber-400 flex items-center mb-2">
          <span class="mr-1.5">⚠️</span> Setup Instructions:
        </p>
        <ul class="text-[11px] text-slate-400 space-y-1.5 list-disc list-inside">
          \${!isWorkerKeySet ? '<li>Go to Worker Dashboard &rarr; <b>Settings</b> &rarr; <b>Variables</b> &rarr; Add <b>WORKER_KEY</b> (value: <code>telebase_worker_secret_2026</code>)</li>' : ''}
          \${!isKVBound ? '<li>Create a KV Namespace <b>TELEBASE_KV</b> &rarr; Go to Worker Settings &rarr; Bind it with variable name <b>TELEBASE_KV</b></li>' : ''}
          \${(isKVBound && !isKVFunctional) ? `<li class="text-red-400">KV Namespace exists but failed read test: <code>\${kvErrorMsg}</code>. Make sure it is properly bound in settings!</li>` : ''}
        </ul>
      </div>
      ` : `
      <div class="w-full bg-slate-950/60 border border-emerald-500/10 p-4 rounded-2xl text-left mt-6">
        <p class="text-xs font-semibold text-emerald-400 flex items-center mb-1">
          <span class="mr-1.5">✓</span> Connection Ready!
        </p>
        <p class="text-[11px] text-slate-400 leading-relaxed">
          Your Telebase Edge caching instance is running and fully verified. Attach the <code>x-worker-key</code> header with your secret key to start writing or fetching high-speed data.
        </p>
      </div>
      `}
    </div>
  </div>
</body>
</html>`;

      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 3. Validate Worker Key for Authentication
    const workerKey = request.headers.get("x-worker-key");
    const secretKey = getEnvVar(env, "WORKER_KEY");

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

    const kv = getEnvVar(env, "TELEBASE_KV");
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

    // 6. POST Operation (Batch Operations)
    if (request.method === "POST") {
      // Batch GET: accepts { keys: ["key1", "key2"] } and returns { "key1": "value1", "key2": "value2" }
      if (key === "batch-get") {
        try {
          const body = await request.json();
          const keys = body.keys;
          if (!Array.isArray(keys)) {
            return new Response("Invalid payload. 'keys' must be an array.", {
              status: 400,
              headers: { "Access-Control-Allow-Origin": "*" }
            });
          }

          const results = {};
          await Promise.all(keys.map(async (k) => {
            const val = await kv.get(k);
            results[k] = val;
          }));

          return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          });
        } catch (err) {
          return new Response(`Batch Read Error: ${err.message}`, {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      // Batch PUT: accepts { pairs: { "key1": "value1", "key2": "value2" } }
      if (key === "batch-put") {
        try {
          const body = await request.json();
          const pairs = body.pairs;
          if (!pairs || typeof pairs !== "object") {
            return new Response("Invalid payload. 'pairs' must be a key-value object.", {
              status: 400,
              headers: { "Access-Control-Allow-Origin": "*" }
            });
          }

          await Promise.all(Object.entries(pairs).map(async ([k, val]) => {
            await kv.put(k, val);
          }));

          return new Response("OK", {
            status: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
            }
          });
        } catch (err) {
          return new Response(`Batch Write Error: ${err.message}`, {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" }
          });
        }
      }
    }

    return new Response("Method not allowed or invalid route", {
      status: 405,
      headers: {
        "Allow": "GET, PUT, POST, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(`Worker Runtime Error: ${err.message}\n${err.stack}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleFetch(request, env, ctx);
  }
};

// Auto-register classic Service Worker fetch handler if deployed in non-module format
if (typeof addEventListener === 'function') {
  addEventListener('fetch', event => {
    event.respondWith(
      handleFetch(
        event.request,
        typeof globalThis !== 'undefined' ? globalThis : self,
        event
      )
    );
  });
}
