import { Play } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-zinc-800/40">
        <div className="space-y-2 flex-1">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Getting Started with Telebase</h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Telebase is a production-grade serverless database and file storage engine that uses Telegram as the ultimate, free persistent storage backend and Cloudflare KV as an ultra-fast edge cache.
          </p>
        </div>
        <a
          href="https://www.youtube.com/watch?v=setup_video_placeholder"
          target="_blank"
          rel="noreferrer"
          className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 flex-shrink-0"
        >
          <Play size={14} />
          Watch Setup Video
        </a>
      </div>

      <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">Why Telebase?</h2>
        <ul className="space-y-3 text-zinc-300">
          <li className="flex gap-2"><span className="text-blue-500 font-bold">1.</span> <strong>Infinite Free Storage:</strong> Leverage Telegram's infrastructure to store multi-gigabyte files.</li>
          <li className="flex gap-2"><span className="text-emerald-500 font-bold">2.</span> <strong>Ultra-Low Latency:</strong> Cloudflare KV caches your SQL/NoSQL responses globally, delivering sub-15ms reads.</li>
          <li className="flex gap-2"><span className="text-purple-500 font-bold">3.</span> <strong>Zero-Knowledge Encryption:</strong> AES-256-GCM is applied before data leaves your application. Telegram sees only ciphertext.</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white mt-8">Quick Start</h2>
        <p className="text-zinc-400">All API requests to your Telebase instance must include your API Key.</p>
        <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl overflow-hidden">
          <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800/50 text-xs font-mono text-zinc-500">Headers</div>
          <pre className="p-4 text-sm font-mono text-blue-300 overflow-x-auto">
{`{
  "Content-Type": "application/json",
  "x-api-key": "YOUR_API_KEY"
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
