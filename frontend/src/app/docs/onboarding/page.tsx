import { Database, Zap, Key, Table2, UploadCloud, Bot, ArrowRight, Play } from "lucide-react";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Onboarding & Setup Guide - Telebase",
  description: "A step-by-step checklist to configure your first serverless database, establish Telegram secure permanent storage, and generate authentication credentials.",
  path: "/docs/onboarding",
});

export default function OnboardingDocs() {
  return (
    <div className="space-y-8">
      {/* Page Title & Intro */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-zinc-800/40">
        <div className="space-y-3 flex-1">
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Onboarding & Setup Guide
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
            Follow this 5-step checklist to configure your first serverless database, establish Telegram secure permanent storage, and generate authentication credentials.
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

      {/* Checklist Cards Container */}
      <div className="space-y-6">
        
        {/* Step 1 */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/60 transition-all">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400 font-bold">
              1
            </div>
            <div className="space-y-3 flex-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Create a New Project
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Projects isolate your database tables, index, settings, and file assets. To create a new namespace:
              </p>
              <ul className="list-disc pl-5 text-zinc-400 text-xs space-y-1.5 leading-relaxed">
                <li>Click the <strong className="text-white">+ New Project</strong> button inside the sidebar or dashboard.</li>
                <li>Give your project a descriptive name (e.g. <code>my-prod-db</code>).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/60 transition-all">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold">
              2
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Configure Telegram Bot & Channel
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed mt-1">
                  Telebase uploads database state and file chunks as encrypted documents to a private Telegram channel.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/30 border border-zinc-800/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Bot size={14} className="text-blue-400" />
                    <span>A. Create a Bot</span>
                  </div>
                  <ol className="list-decimal pl-4 text-[11px] text-zinc-400 space-y-1">
                    <li>Message <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">@BotFather</a> on Telegram.</li>
                    <li>Send <code>/newbot</code> and follow the instructions.</li>
                    <li>Copy the generated HTTP API Bot Token.</li>
                  </ol>
                </div>

                <div className="bg-black/30 border border-zinc-800/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Database size={14} className="text-emerald-400" />
                    <span>B. Create a Channel</span>
                  </div>
                  <ol className="list-decimal pl-4 text-[11px] text-zinc-400 space-y-1">
                    <li>Create a new Telegram Channel (Private).</li>
                    <li>Add your Bot as an <strong>Administrator</strong>.</li>
                    <li>Grant full posting, deleting, and message-pinning privileges.</li>
                    <li>Obtain your Channel/Chat ID (usually starts with <code>-100</code>).</li>
                  </ol>
                </div>
              </div>

              <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-4 text-xs text-zinc-400 leading-relaxed">
                <strong className="text-white block mb-1">Connecting to Project settings:</strong>
                Navigate to Project settings inside the dashboard, enter the <strong>Channel ID</strong> and <strong>Bot Token</strong>, then save settings. Telebase will automatically attempt to establish connection.
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/60 transition-all">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-400 font-bold">
              3
            </div>
            <div className="space-y-3 flex-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Obtain your API Key
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                All requests to the Telebase engine require verification via an API Key.
              </p>
              <div className="space-y-2">
                <p className="text-zinc-400 text-xs">
                  A unique API key is automatically generated when your project is created. In your Project overview panel, locate the <strong className="text-white">API Key</strong> section and securely copy it. Add this to your header variables in every client request:
                </p>
                <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden">
                  <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800/50 text-[10px] font-mono text-zinc-500">Headers</div>
                  <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto">
{`{
  "x-api-key": "YOUR_PROJECT_API_KEY"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/60 transition-all">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400 font-bold">
              4
            </div>
            <div className="space-y-3 flex-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Create your First Table
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Tables dictate how your structured data is cached and stored. Telebase compiles schemas locally, synchronizes them with Telegram in chunks, and serves them.
              </p>
              <ul className="list-disc pl-5 text-zinc-400 text-xs space-y-1.5 leading-relaxed">
                <li>Under the <strong className="text-white">Tables</strong> panel, click <strong className="text-white">+ Create Table</strong>.</li>
                <li>Set the table name (e.g. <code>users</code>).</li>
                <li>Define fields (e.g., <code>username</code> as <code>string</code>, <code>age</code> as <code>number</code>).</li>
                <li>Save the table configuration.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="bg-[#0a0a0d] border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700/60 transition-all">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0 text-rose-400 font-bold">
              5
            </div>
            <div className="space-y-3 flex-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Upload your First File
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                You can upload files of any size directly. Telebase compresses, encrypts, and chunks them in memory.
              </p>
              <div className="space-y-2">
                <p className="text-zinc-400 text-xs">
                  Inside the dashboard, navigate to the <strong className="text-white">Files</strong> section and drop a file into the drag-and-drop container. It will generate an asset UUID. Alternatively, upload files programmatically via code:
                </p>
                <div className="bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden">
                  <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800/50 text-[10px] font-mono text-zinc-500">API Upload Example</div>
                  <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto">
{`const formData = new FormData();
formData.append("file", fileInput.files[0]);

const response = await fetch("https://telebase.pages.dev/api/data/upload", {
  method: "POST",
  headers: {
    "x-api-key": "YOUR_PROJECT_API_KEY"
  },
  body: formData
});

const data = await response.json();
console.log("File UUID:", data.file.uuid);`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Done Alert */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 text-zinc-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-white text-lg">Congratulations!</h4>
          <p className="text-sm text-zinc-400 mt-1">Your Telebase environment is now initialized and ready to handle serverless SQL and NoSQL operations.</p>
        </div>
        <a
          href="/docs/crud"
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 flex-shrink-0"
        >
          Explore CRUD APIs
          <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
