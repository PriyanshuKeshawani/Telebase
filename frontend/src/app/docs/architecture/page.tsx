export default function ArchitectureDocs() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Architecture Deep Dive</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Telebase's biggest differentiator is its hybrid architecture: <strong>Telegram + KV Cache + State Sharding + Chunk TTL</strong>.
        </p>
      </div>

      <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">The Flow</h2>
        <pre className="text-sm font-mono text-zinc-400 leading-relaxed overflow-x-auto bg-black/40 p-4 rounded-xl border border-zinc-800/50">
{`[ Client / Web App ] 
        │
        ▼ (Reads <15ms / Writes <150ms via HTTP REST)
┌────────────────────────────────┐
│      Telebase Next.js API      │ ◄───► [ Cloudflare KV Edge Cache ]
└──────────────┬─────────────────┘
               │ (Chunked & Encrypted Background Sync)
               ▼
┌────────────────────────────────┐
│   Telegram Private Channel     │ (Infinite, Permanent Storage)
└────────────────────────────────┘`}
        </pre>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-blue-400">Telegram Permanent Backend</h3>
          <p className="text-zinc-400 text-sm">
            Telegram serves as the ultimate source of truth. Every database table and file is chunked, encrypted with AES-256-GCM, and stored as documents in a private channel.
          </p>
        </div>
        
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-emerald-400">Cloudflare KV Hot Cache</h3>
          <p className="text-zinc-400 text-sm">
            To achieve &lt;15ms latency, Telebase caches master state and table chunks in Cloudflare KV globally. It strictly acts as a cache, not a database.
          </p>
        </div>

        <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-purple-400">State Sharding</h3>
          <p className="text-zinc-400 text-sm">
            Telebase shards individual file metadata (e.g., <code>file_&lt;uuid&gt;.json</code>) directly to KV and Telegram to prevent massive monolithic state congestion at high scale.
          </p>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-amber-400">24h Chunk TTL</h3>
          <p className="text-zinc-400 text-sm">
            Large file chunks stored in Cloudflare KV automatically expire after 24 hours (TTL). When a cache miss occurs, they are seamlessly re-fetched from Telegram, ensuring zero KV storage bloat.
          </p>
        </div>
      </div>
    </div>
  );
}
