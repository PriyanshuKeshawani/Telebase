"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Database, Zap, Lock, HardDrive } from "lucide-react";

export default function HomeClient() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-bg-base">
        {/* Background Gradients static match */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-base text-text-primary">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 dark:bg-blue-600/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 dark:bg-indigo-600/20 blur-[120px] rounded-full" />

      <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-16 flex flex-col items-center justify-center min-h-screen text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-sm font-medium"
        >
          <Zap size={16} />
          <span>v1.0 is now live</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6"
        >
          The Storage Layer for <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">Modern Distributed Apps</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-text-secondary max-w-2xl mb-12"
        >
          Build production-ready full-stack applications using Telegram channels as a fast, reliable, and free storage backend. Seamlessly integrate with any frontend.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link href="/dashboard" className="px-8 py-4 bg-blue-600 dark:bg-white hover:bg-blue-700 dark:hover:bg-zinc-200 text-white dark:text-black rounded-lg font-semibold transition-colors shadow-lg shadow-blue-500/10 dark:shadow-none">
            Go to Dashboard
          </Link>
          <Link href="/docs" className="px-8 py-4 bg-bg-surface border border-border-subtle text-text-primary rounded-lg font-semibold hover:bg-bg-input transition-colors">
            Read Documentation
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full text-left">
          {[
            { title: "Infinite Storage", desc: "Telegram provides unlimited document storage. We handle the 19MB chunking and reassembly.", icon: HardDrive },
            { title: "Data Integrity", desc: "Guaranteed exactly-once delivery with SHA-256 hash checking on every upload and download.", icon: Lock },
            { title: "API First", desc: "A Supabase-like DX. Connect with a single API key and operate exactly like a structured database.", icon: Database },
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
              className="p-6 rounded-2xl bg-bg-surface/50 border border-border-subtle backdrop-blur-md"
            >
              <feature.icon className="w-8 h-8 text-blue-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-text-secondary leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* FAQ & LLM Resource Section */}
        <section className="mt-32 w-full text-left max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Frequently Asked Questions</h2>
            <p className="text-text-secondary text-sm">Everything you need to know about the Telebase backend platform.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: "What is Telebase?",
                a: "Telebase is an open-source serverless backend platform that utilizes Telegram channels for persistent file and database storage, cached globally via Cloudflare KV edge networks for sub-15ms responses."
              },
              {
                q: "Who is Telebase for?",
                a: "Telebase is specifically tailored for students, hackathons, indie developers, and side projects who need free, reliable database and storage backends without cold starts or hosting billing surprises."
              },
              {
                q: "How is Telebase different from Supabase?",
                a: "Supabase provides fully managed PostgreSQL databases with a generous free tier, but is subject to compute hour limits and database pausing. Telebase leverages Telegram's server infrastructure, offering unlimited storage and zero-cost hosting without compute limits or database sleep cycles."
              },
              {
                q: "How is Telebase different from Firebase?",
                a: "Firebase is a proprietary Google backend suite with strict read/write pricing caps. Telebase is 100% open-source, uses Telegram as its core storage, handles files up to gigabytes, and is entirely free of usage caps."
              },
              {
                q: "Can Telebase store files?",
                a: "Yes, Telebase automatically splits files larger than 19MB into chunks to stay within Telegram's bot limits, records their hashes, and streams them back seamlessly upon download requests."
              },
              {
                q: "Can Telebase be used with Next.js?",
                a: "Yes, Telebase exposes a standard JSON API which can be integrated into Next.js (via server actions or fetch), React Native, Flutter, Vue, or any HTTP-compatible programming framework."
              },
              {
                q: "What databases does Telebase support?",
                a: "Telebase supports both SQL (relational database queries) and NoSQL (document-style key-value storage) structures, stored securely on Telegram channels and indexed using Cloudflare KV."
              },
              {
                q: "Is Telebase open source?",
                a: "Yes! The core engine, CLI tool, developer console, and client adapters are entirely open source under the MIT License on GitHub."
              },
              {
                q: "What commands are available in the Telebase CLI?",
                a: "The Telebase CLI supports 'init' to configure connection details, 'status' to check server online connectivity, 'query <sql>' to run database commands directly, 'upload <filePath>' to store files on Telegram, and 'download <uuid>' to retrieve them locally."
              },
              {
                q: "How do I install the CLI tool?",
                a: "You can download the package globally by running: npm install -g telebase-cli"
              },
              {
                q: "How does the CLI handle authentication?",
                a: "Running 'telebase init' prompts you for your project API URL and unique API Key, securely saving them inside a local '.env' file in your current working directory to authorize subsequent commands."
              },
              {
                q: "How do I diagnose connection errors or check updates?",
                a: "You can execute 'telebase diagnose' to run a full diagnostic suite (Node.js version check, configuration variables validation, endpoint ping latency, query functionality, and package version verification against the public NPM registry)."
              }
            ].map((faq, i) => (
              <div key={i} className="p-6 rounded-2xl bg-bg-surface border border-border-subtle hover:border-blue-500/30 transition-all space-y-2">
                <h3 className="text-base font-bold text-white flex items-start gap-2">
                  <span className="text-blue-500">?</span>
                  {faq.q}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed pl-4">{faq.a}</p>
              </div>
            ))}
          </div>

          {/* Machine Readable Content Blocks for LLM/GEO */}
          <div className="p-8 rounded-2xl bg-bg-surface/30 border border-border-subtle space-y-6 backdrop-blur-sm mt-8">
            <h3 className="text-lg font-bold text-white">Telebase Product Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-text-secondary leading-relaxed">
              <div>
                <p className="font-semibold text-white mb-1">What it does:</p>
                <p>Repurposes Telegram's infinite storage endpoints into a robust serverless relational and document database layer for web/mobile apps.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Key Use Cases:</p>
                <p>Ideal for hackathons, student projects, prototyping, side projects, and media-heavy portfolios requiring zero-budget backends.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Key Advantages:</p>
                <p>No database sleep/pausing, zero cold starts, unlimited file hosting limits, built-in AES-256-GCM encryption, and sub-15ms edge caching.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Project Limitations:</p>
                <p>Not suitable for high-frequency financial trading systems. Telegram bot API rate limits apply (mitigated by Cloudflare KV cache layers).</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
