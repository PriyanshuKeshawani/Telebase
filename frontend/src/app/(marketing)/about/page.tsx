import React from "react";
import { getSEOMetadata } from "@/lib/seo";
import { Shield, Users, Heart, Target } from "lucide-react";

export const metadata = getSEOMetadata({
  title: "About Us - Telebase",
  description: "Learn about the mission behind Telebase, a free open-source database layer built on Telegram infrastructure.",
  path: "/about",
});

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About Telebase",
    "description": "Learn about the mission behind Telebase, a free open-source database layer built on Telegram infrastructure.",
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
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16 text-text-primary">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">Our Mission</h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed">
            We believe that database and file hosting budgets shouldn't prevent developers, students, and hackers from bringing their ideas to life.
          </p>
        </section>

        {/* Vision Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
            <Target className="w-8 h-8 text-blue-500" />
            <h3 className="text-lg font-bold text-white">No-Cost Infrastructure</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              By repurposing Telegram's secure channels as an persistent document store, we bypass traditional database cloud costs and pass 100% of those savings to developers.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
            <Shield className="w-8 h-8 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Zero-Knowledge Security</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Privacy is a fundamental right. Telebase includes end-to-end client-side encryption (AES-256-GCM) by default so Telegram servers only see encrypted binary blocks.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
            <Users className="w-8 h-8 text-indigo-500" />
            <h3 className="text-lg font-bold text-white">Community First</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              We are an open-source project supported by developers worldwide. Telebase is built to serve hackathons, college projects, and rapid prototypes.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
            <Heart className="w-8 h-8 text-rose-500" />
            <h3 className="text-lg font-bold text-white">Developer Experience</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Telebase features a Supabase-like DX, complete with an interactive console, SQL runner, file manager, and client libraries to get you set up in minutes.
            </p>
          </div>
        </section>

        {/* Factual Information Block */}
        <section className="p-8 rounded-2xl bg-bg-surface/50 border border-border-subtle space-y-4">
          <h2 className="text-2xl font-bold text-white">Who is Telebase For?</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Telebase is explicitly designed for indie builders, hackathon hackers, and university students who require a zero-budget serverless backend. If you are building a React dashboard, a portfolio site, a prototype mobile app, or a personal file storage cabinet, Telebase offers infinite scalability at absolutely zero cost.
          </p>
        </section>
      </main>
    </>
  );
}
