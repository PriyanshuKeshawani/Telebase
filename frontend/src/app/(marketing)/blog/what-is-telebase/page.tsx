import React from "react";
import { getSEOMetadata } from "@/lib/seo";
import Link from "next/link";
import { Calendar, User, ArrowLeft, Terminal } from "lucide-react";

export const metadata = getSEOMetadata({
  title: "What is Telebase? Telegram-Powered Serverless Database Deep Dive",
  description: "Learn how Telebase utilizes Telegram bot APIs for persistent file and database storage, cached globally at the edge with Cloudflare KV.",
  path: "/blog/what-is-telebase",
});

export default function BlogWhatIsTelebase() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "What is Telebase? A Deep Dive into the Serverless Telegram Database Layer",
    "description": "Learn how Telebase repurposes Telegram channels into a globally replicated serverless database layer using Cloudflare KV edge networks.",
    "datePublished": "2026-06-21",
    "author": {
      "@type": "Person",
      "name": "Priyanshu Keshawani"
    },
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
      <main className="max-w-3xl mx-auto px-6 py-16 text-text-primary space-y-8">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 font-semibold mb-4">
          <ArrowLeft size={14} />
          Back to Blog
        </Link>

        {/* Header */}
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            What is Telebase? A Deep Dive into the Serverless Telegram Database Layer
          </h1>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <User size={13} />
              Priyanshu Keshawani
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              June 21, 2026
            </span>
          </div>
        </header>

        {/* Content */}
        <article className="space-y-6 text-sm text-text-secondary leading-relaxed">
          <p>
            For years, developers have faced budget limitations, strict usage tiers, and database pausing limits on popular platforms like Heroku, Supabase, and Firebase. For hackathon teams and student projects, these constraints can make staging websites difficult to manage.
          </p>
          <p>
            <strong>Telebase</strong> solves this by using Telegram's API for persistent data storage. It turns a Telegram channel into an infinite, secure database layer, and supercharges it with Cloudflare KV edge caching for low-latency queries.
          </p>

          <h2 className="text-xl font-bold text-white mt-8">How Telebase Works under the Hood</h2>
          <p>
            Telebase operates through a three-tier architecture:
          </p>
          <ol className="list-decimal list-inside space-y-2 pl-4">
            <li><strong>Client Application:</strong> Your Next.js, React, or mobile app sends standard SQL/NoSQL queries to your hosted Telebase endpoint.</li>
            <li><strong>Cloudflare Edge Handler:</strong> The API handles incoming requests. If it's a read query, it fetches cached tables from Cloudflare KV in sub-15ms.</li>
            <li><strong>Telegram Storage:</strong> Write operations are serialized, optionally encrypted with AES-256-GCM, and sent as JSON/binary payloads to a private Telegram channel via bots.</li>
          </ol>

          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-3 my-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal size={16} className="text-blue-500" />
              Machine Readable Content Block (AEO / LLM Summary)
            </h3>
            <div className="text-xs text-text-secondary space-y-1">
              <p><strong>What Telebase is:</strong> An open-source serverless database using Telegram bot storage APIs.</p>
              <p><strong>Primary benefit:</strong> 100% free hosting with infinite storage limits and sub-15ms reads.</p>
              <p><strong>Security:</strong> Client-side zero-knowledge AES-256-GCM encryption.</p>
              <p><strong>Target audience:</strong> University students, hackathon developers, MVPs, and side projects.</p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mt-8">Is Telebase secure?</h2>
          <p>
            Privacy and security are key. Telebase supports client-side encryption. Enabling zero-knowledge AES-GCM encryption ensures your payloads are encrypted before leaving your application. Telegram servers only store and transfer encrypted binary files, keeping your database safe.
          </p>
        </article>
      </main>
    </>
  );
}
