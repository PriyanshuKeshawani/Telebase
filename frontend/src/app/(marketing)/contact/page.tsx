import React from "react";
import { getSEOMetadata } from "@/lib/seo";
import { Github, MessageSquare, Mail, Terminal } from "lucide-react";

export const metadata = getSEOMetadata({
  title: "Contact Support - Telebase",
  description: "Get support for Telebase. Open a GitHub issue, join our Telegram group, or contact our core maintainers.",
  path: "/contact",
});

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Contact Telebase Support",
    "description": "Get support for Telebase. Open a GitHub issue, join our Telegram group, or contact our core maintainers.",
    "url": "https://telebase.pages.dev/contact"
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16 text-text-primary">
        <section className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">Get in Touch</h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed">
            Have questions about Telebase, found a bug, or need help integrating it with your next app? We are here to support you.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GitHub Card */}
          <a
            href="https://github.com/PriyanshuKeshawani/Telebase/issues"
            target="_blank"
            rel="noreferrer"
            className="p-6 rounded-2xl bg-bg-surface border border-border-subtle hover:border-blue-500/30 transition-all space-y-3 group"
          >
            <Github className="w-8 h-8 text-white group-hover:text-blue-500 transition-colors" />
            <h3 className="text-lg font-bold text-white">GitHub Issues</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Report bugs, request features, or review active development tasks directly on our open-source repository board.
            </p>
          </a>

          {/* Telegram Card */}
          <a
            href="https://telegram.org"
            target="_blank"
            rel="noreferrer"
            className="p-6 rounded-2xl bg-bg-surface border border-border-subtle hover:border-blue-500/30 transition-all space-y-3 group"
          >
            <MessageSquare className="w-8 h-8 text-blue-400 group-hover:text-blue-500 transition-colors" />
            <h3 className="text-lg font-bold text-white">Community Chat</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Connect with fellow developers, seek onboarding help, and share your projects in the official Telegram developers group.
            </p>
          </a>

          {/* Docs Card */}
          <a
            href="/docs"
            className="p-6 rounded-2xl bg-bg-surface border border-border-subtle hover:border-blue-500/30 transition-all space-y-3 group"
          >
            <Terminal className="w-8 h-8 text-emerald-400 group-hover:text-emerald-500 transition-colors" />
            <h3 className="text-lg font-bold text-white">Interactive Docs</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Browse our comprehensive code examples, setup guides, schema designs, and developer reference guides.
            </p>
          </a>

          {/* Email Support */}
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
            <Mail className="w-8 h-8 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Direct Email</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              For security disclosures or administrative queries, contact us at: <span className="font-semibold text-white">support@telebase.dev</span>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
