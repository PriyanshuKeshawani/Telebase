import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Authentication and Identity Provider - Telebase",
  description: "Learn about the cryptographically secure NextAuth login flow and Telegram identity provider used in Telebase.",
  path: "/docs/authentication",
});

export default function AuthDocs() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Authentication</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Every HTTP request to your Telebase instance must be authenticated.
        </p>
      </div>

      <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">API Keys</h2>
        <p className="text-zinc-300">
          You can create projects inside your Telebase Dashboard. Each project generates a unique API key that scopes data specifically to that project.
        </p>

        <h3 className="text-lg font-bold text-white mt-4">Passing the API Key</h3>
        <p className="text-zinc-400 text-sm mb-2">Include the key in the <code>x-api-key</code> header for POST requests, or as an <code>apiKey</code> query parameter for GET downloads.</p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
            {`const response = await fetch('https://telebase.pages.dev/api/db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'tb_live_xxxxxxxxxxxxxxxxxxxx'
  },
  body: JSON.stringify({ ... })
});`}
          </pre>
        </div>
      </div>
    </div>
  );
}
