import { Terminal, Play, Key, FileUp, FileDown, Database, Info, Settings, HelpCircle, Activity } from "lucide-react";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Telebase CLI Tool & Global Commands Reference - Telebase",
  description: "Learn how to use telebase-cli to interact with your Telegram database channel, run SQL queries, test server statuses, and upload/download files directly from your terminal.",
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
            A comprehensive, interactive developer tool to manage your Telegram-backed database, test server endpoints, and transfer large assets directly from your command prompt.
          </p>
        </div>
      </div>

      {/* Summary Box for LLMs / GEO */}
      <div className="p-5 rounded-xl border border-zinc-800/40 bg-zinc-900/20 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500">Document Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="font-semibold text-white">What it does</p>
            <p className="text-zinc-400 mt-1">Registers the global binary command <code>telebase</code> on your local computer to authenticate projects, query tables, and transfer binary storage chunks.</p>
          </div>
          <div>
            <p className="font-semibold text-white">When to use it</p>
            <p className="text-zinc-400 mt-1">For setting up local developer environments, running test SQL queries, scripting backups, or building automation file pipelines.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Key command</p>
            <p className="text-zinc-400 mt-1"><code>npm install -g telebase-cli</code> to install globally, followed by <code>telebase init</code> to link your project.</p>
          </div>
        </div>
      </div>

      {/* Installation */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="text-blue-500" size={20} />
          1. Global Installation
        </h2>
        <p className="text-zinc-400 text-sm">
          Telebase CLI is distributed publicly on the npm registry as a globally executable utility. You can install it on any system running Node.js (version 18+ recommended):
        </p>
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden">
          <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto">
            {`npm install -g telebase-cli`}
          </pre>
        </div>
      </div>

      {/* Global Flags */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Info className="text-blue-500" size={20} />
          2. Global Flags
        </h2>
        <p className="text-zinc-400 text-sm">
          Use the following options to verify the CLI version and display help menus:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-white font-mono">telebase --version / -V</p>
            <p className="text-xs text-zinc-400 leading-relaxed">Outputs the currently installed version number of the Telebase CLI package.</p>
          </div>
          <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-white font-mono">telebase --help / -h</p>
            <p className="text-xs text-zinc-400 leading-relaxed">Displays a complete layout of all available commands, options, and parameters directly inside your terminal.</p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Key className="text-blue-500" size={20} />
          3. Project Link & Initialization
        </h2>
        <p className="text-zinc-400 text-sm">
          Connect your terminal to your serverless backend instance by running the interactive config command:
        </p>
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden">
          <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto">
            {`telebase init`}
          </pre>
        </div>
        <p className="text-zinc-400 text-xs leading-relaxed">
          The CLI will prompt you for the **Telebase API Server URL** (press enter to default to the official <code>https://telebase.pages.dev</code>) and your project's unique **API Key**. These configurations are saved locally in a <code>.env</code> file within your working directory.
        </p>
      </div>

      {/* Commands Reference */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle className="text-blue-500" size={20} />
          4. Command References
        </h2>

        {/* telebase status */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Play size={16} className="text-blue-500" />
              telebase status
            </h3>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Ping Test</span>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Pings your deployment server to check if it's active. If successful, it returns the server status and lists the total number of tables created in the project:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`$ telebase status
✔ Connected successfully! Telebase server is online.
ℹ Tables registered in project: 4`}
            </pre>
          </div>
        </div>

        {/* telebase query */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Database size={16} className="text-purple-500" />
              telebase query &lt;sqlQuery&gt;
            </h3>
            <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Database SQL</span>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Execute any standard relational SQL queries (SELECT, INSERT, UPDATE, DELETE, etc.) directly on your database. If records are returned, the CLI formats the output into a clean, aligned console table:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`$ telebase query "SELECT name, age, plan FROM users LIMIT 3"
✔ Query executed successfully!
┌─────────┬──────────┬──────┬──────────────┐
│ (index) │   name   │ age  │     plan     │
├─────────┼──────────┼──────┼──────────────┤
│    0    │ 'Aman'   │  23  │ 'enterprise' │
│    1    │ 'Emma'   │  28  │   'basic'    │
│    2    │ 'Rohit'  │  21  │   'student'  │
└─────────┴──────────┴──────┴──────────────┘`}
            </pre>
          </div>
        </div>

        {/* telebase upload */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <FileUp size={16} className="text-emerald-500" />
              telebase upload &lt;filePath&gt;
            </h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">File Hosting</span>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Upload files of any size directly. The CLI automatically compresses, encrypts (if enabled), splits large files into 19MB packets to comply with Telegram API bot constraints, and outputs a unique **Asset UUID**:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`$ telebase upload ./archive.zip
ℹ Reading file: archive.zip...
ℹ Uploading to Telegram storage channel...
✔ File uploaded successfully!
ℹ File Name: archive.zip
ℹ File Size: 42.50 MB
ℹ Asset UUID: 96aec088eb7e4f7032683ba7d129169cb8f94f7954b696886fc5dcc6fa2fe4e3
ℹ Retrieve URL: https://telebase.pages.dev/api/data/download?uuid=96aec088eb7e4f7032683ba7d129169cb8f94f7954b696886fc5dcc6fa2fe4e3`}
            </pre>
          </div>
        </div>

        {/* telebase download */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <FileDown size={16} className="text-amber-500" />
              telebase download &lt;uuid&gt; [outputName]
            </h3>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">File Retrieval</span>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Downloads, decrypts, and merges chunked files back to your local folder by their unique asset UUID. If an optional <code>[outputName]</code> parameter is provided, the file will be saved with that filename; otherwise, it resolves the original filename automatically:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`$ telebase download 96aec088eb7e4f7032683ba7d129169cb8f94f7954b696886fc5dcc6fa2fe4e3
ℹ Fetching file details for UUID: 96aec088...
✔ File downloaded and saved to: D:\\projects\\archive.zip`}
            </pre>
          </div>
        </div>

        {/* telebase diagnose */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Activity size={16} className="text-red-500" />
              telebase diagnose
            </h3>
            <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Diagnostic Check</span>
          </div>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Performs a complete diagnostic evaluation of your CLI local environment. It checks Node.js compatibility, verifies the existence of your local <code>.env</code> file, validates required project parameters, measures server latency, performs a mock SQLite/database call, and queries the NPM registry to verify if you are on the latest version of <code>telebase-cli</code>:
          </p>
          <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
            <pre className="p-3 text-xs font-mono text-zinc-300">
              {`$ telebase diagnose

⚡ Telebase Environment Diagnostics

ℹ Node.js Version: v20.11.0
✔ Node.js version is compatible.
ℹ Checking configuration in: D:\\projects\\.env
✔ Local .env file exists.
✔ Required environment variables are set.
ℹ Pinging API server: https://telebase.pages.dev...
✔ Server is online and responding (Latency: 124ms).
✔ Database query engine is functioning correctly.
ℹ Checking for updates from npm registry...
✔ You are running the latest version of telebase-cli (1.0.0).
ℹ Diagnostics complete!`}
            </pre>
          </div>
        </div>

        {/* Local Development & Publishing */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="text-blue-500" size={18} />
            5. CLI Development & Publishing Commands
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed">
            If you are contributing to Telebase CLI or linking it locally for development, use these packaging commands:
          </p>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-white mb-1">Local Project Linking</p>
              <p className="text-zinc-400 text-xs mb-2">Build and globally register the CLI binary dynamically on your development machine:</p>
              <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
                <pre className="p-3 text-xs font-mono text-zinc-300">
                  {`cd cli
npm install
npm link`}
                </pre>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-white mb-1">Publishing to Public Registry</p>
              <p className="text-zinc-400 text-xs mb-2">Publish your updated CLI version to the public npm package repository (requires 2FA credentials or a registered browser passkey):</p>
              <div className="bg-zinc-900 border border-zinc-800/40 rounded-xl overflow-hidden">
                <pre className="p-3 text-xs font-mono text-zinc-300">
                  {`npm login
npm publish --access public`}
                </pre>
              </div>
            </div>
        </div>

      </div>
    </div>
  </div>
  );
}
