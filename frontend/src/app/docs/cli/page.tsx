import { Terminal, Play, Key, FileUp, FileDown, Database } from "lucide-react";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Telebase CLI Tool & Global Commands - Telebase",
  description: "Learn how to use telebase-cli to interact with your Telegram database channel, run SQL queries, and manage file storage directly from your terminal.",
  path: "/docs/cli",
});

export default function CliDocs() {
  return (
    <div className="space-y-8">
      {/* Page Title & Intro */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-zinc-800/40">
        <div className="space-y-3 flex-1">
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Terminal className="text-blue-500 w-8 h-8" />
            Command Line Interface (CLI)
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
            Interact with your Telegram database, upload file chunks, and run SQL queries directly from your local terminal.
          </p>
        </div>
      </div>

      {/* Summary Box for LLMs / GEO */}
      <div className="p-5 rounded-xl border border-zinc-800/40 bg-zinc-900/20 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500">Document Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="font-semibold text-white">What it does</p>
            <p className="text-zinc-400 mt-1">Globally registers the <code>telebase</code> binary command to manage API keys, query tables, and transfer storage assets.</p>
          </div>
          <div>
            <p className="font-semibold text-white">When to use it</p>
            <p className="text-zinc-400 mt-1">For local scripting, rapid terminal query validation, backing up database state, or automated asset pipelines.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Example usage</p>
            <p className="text-zinc-400 mt-1"><code>npm install -g telebase-cli</code> followed by <code>telebase init</code> to authenticate.</p>
          </div>
        </div>
      </div>

      {/* Installation */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">1. Installation</h2>
        <p className="text-zinc-400 text-sm">
          Telebase CLI is distributed globally via the npm registry. Install it globally on your machine using Node.js package manager:
        </p>
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden">
          <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto">
            {`npm install -g telebase-cli`}
          </pre>
        </div>
      </div>

      {/* Initialization */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">2. Configuration Setup</h2>
        <p className="text-zinc-400 text-sm">
          Once installed, initialize your connection by binding the CLI to your deployment server URL and project API Key:
        </p>
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden">
          <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto">
            {`telebase init`}
          </pre>
        </div>
        <p className="text-zinc-400 text-xs">
          This prompts you for the configurations and writes a local <code>.env</code> file in your active terminal folder.
        </p>
      </div>

      {/* Commands Overview */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">3. Commands Reference</h2>

        {/* Status command */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Play size={16} className="text-blue-500" />
            telebase status
          </h3>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Checks if your deployment endpoint is active and lists the total number of tables registered in the project namespace:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`telebase status`}
            </pre>
          </div>
        </div>

        {/* Query command */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Database size={16} className="text-purple-500" />
            telebase query
          </h3>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Execute SQL queries directly on your database. Results are printed in a clean console table structure:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`telebase query "SELECT id, name, age FROM users WHERE status = 'active' ORDER BY age DESC LIMIT 5"`}
            </pre>
          </div>
        </div>

        {/* Upload command */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileUp size={16} className="text-emerald-500" />
            telebase upload
          </h3>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Upload files of any size directly. Telebase automatically splits files into chunks under Telegram bot API limits, compresses them, and generates an Asset UUID:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`telebase upload ./my_deployment_archive.zip`}
            </pre>
          </div>
        </div>

        {/* Download command */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileDown size={16} className="text-amber-500" />
            telebase download
          </h3>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Download your files from the Telegram storage channel by their unique asset UUID:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`telebase download <asset-uuid> [custom-file-name.zip]`}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
}
