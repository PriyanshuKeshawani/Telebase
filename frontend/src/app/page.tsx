"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Database, Zap, Lock, HardDrive } from "lucide-react";

export default function Home() {
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
      </div>
    </main>
  );
}
