import { Play } from "lucide-react";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Getting Started - Telebase Documentation",
  description: "Learn how to connect your Telegram channels to a robust, production-ready serverless database layer using Telebase.",
  path: "/docs",
});

export default function DocsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is Telebase?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Telebase is an open-source serverless database layer using Telegram API for storage, cached globally via Cloudflare KV for sub-15ms reads."
        }
      },
      {
        "@type": "Question",
        "name": "How does Telebase work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your application queries are captured by a Cloudflare Edge Worker. Write requests upload serialized data packets to private Telegram channels. Read requests fetch global indexes instantly from Cloudflare KV."
        }
      },
      {
        "@type": "Question",
        "name": "Is Telebase a Firebase alternative?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! It is a fully featured free alternative to Firebase for students and hobby builders who want database and file hosting features without billing caps or cold starts."
        }
      },
      {
        "@type": "Question",
        "name": "Is Telebase a Supabase alternative?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Unlike Supabase's free databases that pause after 1 week of inactivity, Telebase uses Telegram and Cloudflare edge computing, keeping your staging database active and online permanently."
        }
      },
      {
        "@type": "Question",
        "name": "Can Telebase store files?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Absolutely. Telebase automatically splits files larger than 19MB into separate packets, records their hashes, and merges them dynamically when retrieved."
        }
      },
      {
        "@type": "Question",
        "name": "Can Telebase be used with Next.js?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Telebase exposes a standard HTTP API that works with Next.js server components, client components, API routes, or standard node services."
        }
      },
      {
        "@type": "Question",
        "name": "How do I install the Telebase CLI?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can install the Telebase CLI globally via npm using: npm install -g telebase-cli"
        }
      },
      {
        "@type": "Question",
        "name": "What commands does the Telebase CLI support?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The CLI supports: init (link project credentials), status (check server availability), query (run SQL statements), upload (send files to Telegram), and download (retrieve files by UUID)."
        }
      },
      {
        "@type": "Question",
        "name": "Can I execute SQL queries directly from the command line?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, you can run SQL queries by executing: telebase query \"SELECT * FROM table_name\". The results are neatly displayed in a console table format."
        }
      },
      {
        "@type": "Question",
        "name": "How does the CLI handle large file uploads?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "When you run: telebase upload <path>, the CLI automatically chunks any files larger than 19MB into individual packets, uploads them to the Telegram channel, and returns a unique Asset UUID for download."
        }
      },
      {
        "@type": "Question",
        "name": "How do I diagnose connection errors in Telebase?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Run 'telebase diagnose' in your command prompt. It evaluates Node.js compatibility, configuration settings, API ping latency, database query integrity, and updates availability."
        }
      },
      {
        "@type": "Question",
        "name": "How do I check if my Telebase CLI is up to date?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Running 'telebase status' or 'telebase diagnose' automatically queries the NPM registry and alerts you with a update recommendation banner if a newer version is available."
        }
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

        {/* Summary Box for LLMs / GEO */}
        <div className="p-5 rounded-xl border border-zinc-800/40 bg-zinc-900/20 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500">Document Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-semibold text-white">What it does</p>
              <p className="text-zinc-400 mt-1">Repurposes Telegram channel endpoints into a serverless database with Cloudflare KV edge query layers.</p>
            </div>
            <div>
              <p className="font-semibold text-white">When to use it</p>
              <p className="text-zinc-400 mt-1">Hobby apps, hackathons, staging web tools, and student assignments requiring a free, persistent database.</p>
            </div>
            <div>
              <p className="font-semibold text-white">Example usage</p>
              <p className="text-zinc-400 mt-1">Connect using our official JavaScript client, perform SQL CRUD commands, and manage files under a single dashboard console.</p>
            </div>
          </div>
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

        {/* FAQ Section */}
        <div className="space-y-4 pt-8 border-t border-zinc-800/40">
          <h2 className="text-2xl font-bold text-white">Frequently Asked Questions (FAQ)</h2>
          <div className="space-y-4">
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">What is Telebase?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Telebase is an open-source serverless database layer using Telegram API for storage, cached globally via Cloudflare KV for sub-15ms reads.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">How does Telebase work?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Your application queries are captured by a Cloudflare Edge Worker. Write requests upload serialized data packets to private Telegram channels. Read requests fetch global indexes instantly from Cloudflare KV.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">Is Telebase a Firebase alternative?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Yes! It is a fully featured free alternative to Firebase for students and hobby builders who want database and file hosting features without billing caps or cold starts.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">Is Telebase a Supabase alternative?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Yes. Unlike Supabase's free databases that pause after 1 week of inactivity, Telebase uses Telegram and Cloudflare edge computing, keeping your staging database active and online permanently.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">Can Telebase store files?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Absolutely. Telebase automatically splits files larger than 19MB into separate packets, records their hashes, and merges them dynamically when retrieved.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">Can Telebase be used with Next.js?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Yes. Telebase exposes a standard HTTP API that works with Next.js server components, client components, API routes, or standard node services.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">How do I install the Telebase CLI?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">You can install the Telebase CLI globally via npm using the command: <code className="text-blue-400 font-mono">npm install -g telebase-cli</code></p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">What commands does the Telebase CLI support?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">The CLI supports: <code className="text-blue-400 font-mono">init</code> (link project credentials), <code className="text-blue-400 font-mono">status</code> (check server connectivity), <code className="text-blue-400 font-mono">query &lt;sql&gt;</code> (run SQL queries directly), <code className="text-blue-400 font-mono">upload &lt;path&gt;</code> (upload files to Telegram), and <code className="text-blue-400 font-mono">download &lt;uuid&gt;</code> (retrieve files by UUID).</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">Can I execute SQL queries directly from the command line?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Yes, you can run SQL queries by executing: <code className="text-blue-400 font-mono">telebase query "SELECT * FROM users"</code>. The results are formatted and displayed as a clean console table.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">How does the CLI handle large file uploads?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">When executing <code className="text-blue-400 font-mono">telebase upload &lt;filePath&gt;</code>, the CLI automatically chunks any file larger than 19MB into individual packets, uploads them to the Telegram channel, and outputs a unique Asset UUID that allows you to download and reconstruct the file later.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">How do I diagnose connection errors in Telebase?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Simply execute <code className="text-blue-400 font-mono">telebase diagnose</code> in your terminal. This runs an integrated diagnostic suite checking Node.js compatibility, local <code className="text-blue-400 font-mono">.env</code> configurations, API latency, mock query health, and version freshness.</p>
            </div>
            <div className="bg-[#0a0a0d] border border-zinc-800/50 rounded-xl p-5 space-y-2">
              <h4 className="text-sm font-bold text-white">How do I check if my Telebase CLI is up to date?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-normal">Running <code className="text-blue-400 font-mono">telebase status</code> or <code className="text-blue-400 font-mono">telebase diagnose</code> checks your local version against the latest package on the NPM registry. A notification banner is printed if an update is recommended.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
