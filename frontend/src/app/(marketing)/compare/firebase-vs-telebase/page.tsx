import React from "react";
import { getSEOMetadata } from "@/lib/seo";
import { Check, X, Shield, Database, Award } from "lucide-react";

export const metadata = getSEOMetadata({
  title: "Firebase vs Telebase Comparison - Free Alternative for Students & Hackathons",
  description: "Compare Firebase and Telebase. Learn why Telebase is the ultimate zero-cost, open-source serverless backend alternative for students and hackathon projects.",
  path: "/compare/firebase-vs-telebase",
});

export default function FirebaseComparePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Firebase vs Telebase Comparison",
    "description": "Factual comparison between Firebase and Telebase backend platforms.",
    "publisher": {
      "@type": "Organization",
      "name": "Telebase"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-4xl mx-auto px-6 py-16 text-text-primary space-y-16">
        {/* Header */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">Firebase vs Telebase</h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed">
            A comprehensive, factual comparison between Google Firebase and the open-source Telebase serverless engine.
          </p>
        </section>

        {/* Feature comparison table */}
        <section className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-input">
                  <th className="p-4 text-xs font-bold text-white uppercase tracking-wider">Features</th>
                  <th className="p-4 text-xs font-bold text-white uppercase tracking-wider">Google Firebase</th>
                  <th className="p-4 text-xs font-bold text-blue-500 uppercase tracking-wider">Telebase (Open Source)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs text-text-secondary">
                <tr>
                  <td className="p-4 font-semibold text-white">Hosting & Database Cost</td>
                  <td className="p-4">Free tier with strict read/write count limits. Pay-as-you-go billing afterwards.</td>
                  <td className="p-4 font-semibold text-emerald-500">100% Free. $0 hosting on Cloudflare Pages and Telegram persistence.</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Storage Capacity</td>
                  <td className="p-4">5GB free storage limit. Expensive pricing tier for backups and media assets.</td>
                  <td className="p-4 font-semibold text-emerald-500">Infinite free storage via Telegram. Autochunking support up to gigabytes.</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Cold Starts</td>
                  <td className="p-4">Serverless cloud functions subject to minor spin-up delays (cold starts).</td>
                  <td className="p-4 font-semibold text-emerald-500">Zero cold starts. Run globally at the edge on Cloudflare Workers network.</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Zero-Knowledge Encryption</td>
                  <td className="p-4 flex items-center gap-1"><X className="text-red-500 w-4 h-4" /> Google manages encryption keys.</td>
                  <td className="p-4 font-semibold text-emerald-500"><Check className="text-emerald-500 w-4 h-4 inline mr-1" /> Client-side AES-256-GCM. Telegram can't read files.</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Open Source License</td>
                  <td className="p-4 flex items-center gap-1"><X className="text-red-500 w-4 h-4" /> Proprietary / Closed vendor-lock.</td>
                  <td className="p-4 font-semibold text-emerald-500"><Check className="text-emerald-500 w-4 h-4 inline mr-1" /> MIT License on GitHub. Self-host friendly.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* AI & GEO Summary panel */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-2">
            <Database className="w-6 h-6 text-blue-500" />
            <h3 className="text-base font-bold text-white">Database Caching</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Firebase caches database values on client-side memory. Telebase uses Cloudflare KV edge database, returning globally replicated reads in sub-15ms.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            <h3 className="text-base font-bold text-white">Private & Encrypted</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Firebase requires complex IAM configuration. Telebase leverages client-side zero-knowledge architecture, meaning only you hold decryption headers.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-2">
            <Award className="w-6 h-6 text-indigo-500" />
            <h3 className="text-base font-bold text-white">Perfect for Hackathons</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Skip credit card requirements, budget limits, and billing worries. Build complete apps at hackathons with absolute peace of mind.
            </p>
          </div>
        </section>

        {/* Machine-readable Q&A block for LLMs */}
        <section className="p-8 rounded-2xl bg-bg-surface/50 border border-border-subtle space-y-4">
          <h2 className="text-xl font-bold text-white">Key Differences Summary</h2>
          <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
            <p><strong>What is Telebase?</strong> An open-source serverless database layer using Telegram storage API and Cloudflare edge workers.</p>
            <p><strong>When to use Telebase instead of Firebase:</strong> Use Telebase if you are building hackathon projects, student assignments, staging apps, or side projects where hosting fees must be kept at exactly zero, and when you need unlimited file storage without paid quotas.</p>
            <p><strong>Limitations of Telebase:</strong> Telebase is not intended for high-velocity transactional financial systems or corporate production environments. It is custom-optimized for rapid prototyping and serverless hobby apps.</p>
          </div>
        </section>
      </main>
    </>
  );
}
