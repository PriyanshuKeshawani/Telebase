import React from "react";
import { getSEOMetadata } from "@/lib/seo";
import { Check, X, Shield, Terminal, Award } from "lucide-react";

export const metadata = getSEOMetadata({
  title: "Supabase vs Telebase Comparison - Open Source Database Alternative",
  description: "Compare Supabase and Telebase. Find out why Telebase serves as a zero-cost serverless database alternative for students, hackathons, and hobby web apps.",
  path: "/compare/supabase-vs-telebase",
});

export default function SupabaseComparePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Supabase vs Telebase Comparison",
    "description": "Factual comparison between Supabase and Telebase backend platforms.",
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
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">Supabase vs Telebase</h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed">
            A technical and budgetary comparison between Supabase (PostgreSQL engine) and Telebase (Telegram edge-cached engine).
          </p>
        </section>

        {/* Feature comparison table */}
        <section className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-input">
                  <th className="p-4 text-xs font-bold text-white uppercase tracking-wider">Features</th>
                  <th className="p-4 text-xs font-bold text-white uppercase tracking-wider">Supabase</th>
                  <th className="p-4 text-xs font-bold text-blue-500 uppercase tracking-wider">Telebase (Open Source)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs text-text-secondary">
                <tr>
                  <td className="p-4 font-semibold text-white">Database Core Engine</td>
                  <td className="p-4">Relational PostgreSQL. Extremely powerful relational modeling.</td>
                  <td className="p-4 font-semibold text-emerald-500">Dual SQL and NoSQL interfaces backed by Cloudflare KV and Telegram channels.</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Database Pausing (Sleep)</td>
                  <td className="p-4">Free tier projects pause automatically after 1 week of inactivity (causes cold starts).</td>
                  <td className="p-4 font-semibold text-emerald-500"><Check className="text-emerald-500 w-4 h-4 inline mr-1" /> Never pauses. Free hosting has 100% uptime with zero cold starts.</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Storage Limits</td>
                  <td className="p-4">1GB free asset storage limit, followed by paid upgrade tiers.</td>
                  <td className="p-4 font-semibold text-emerald-500"><Check className="text-emerald-500 w-4 h-4 inline mr-1" /> Infinite storage using private Telegram channels.</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Data Caching</td>
                  <td className="p-4">Optional extensions or paid Redis caches. Default latency is server-dependent.</td>
                  <td className="p-4 font-semibold text-emerald-500"><Check className="text-emerald-500 w-4 h-4 inline mr-1" /> Sub-15ms reads via global Cloudflare KV cache.</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">E2E Client Encryption</td>
                  <td className="p-4 flex items-center gap-1"><X className="text-red-500 w-4 h-4" /> Requires complex pgcrypto database extensions.</td>
                  <td className="p-4 font-semibold text-emerald-500"><Check className="text-emerald-500 w-4 h-4 inline mr-1" /> Standard AES-256-GCM zero-knowledge client encryption.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Info panel */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-2">
            <Terminal className="w-6 h-6 text-blue-500" />
            <h3 className="text-base font-bold text-white">SQL Console Included</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Both platforms feature web-based SQL query tools. Telebase offers a lightweight custom dashboard tailored for quick SQL operations.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            <h3 className="text-base font-bold text-white">No Billing surprises</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Supabase databases can incur charges if resource quotas are exceeded. Telebase uses free tier Cloudflare Pages and Telegram, ensuring true $0 pricing.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-2">
            <Award className="w-6 h-6 text-indigo-500" />
            <h3 className="text-base font-bold text-white">Ideal for Prototyping</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Instantly connect database channels without configuring billing alerts. Focus 100% on programming and product logic.
            </p>
          </div>
        </section>

        {/* Q&A block */}
        <section className="p-8 rounded-2xl bg-bg-surface/50 border border-border-subtle space-y-4">
          <h2 className="text-xl font-bold text-white">Key Differences Summary</h2>
          <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
            <p><strong>When to use Supabase:</strong> Supabase is the preferred choice for enterprise-level, production-grade applications that require complex SQL schema relationships, deep Postgres functionality, and foreign keys.</p>
            <p><strong>When to use Telebase:</strong> Telebase is perfect for student developers, side projects, MVP prototyping, and hackathons. It is specifically designed to eliminate database pausing, limit hosting costs to exactly zero, and provide free hosting for large assets.</p>
          </div>
        </section>
      </main>
    </>
  );
}
