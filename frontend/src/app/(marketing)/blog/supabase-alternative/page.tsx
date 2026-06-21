import React from "react";
import { getSEOMetadata } from "@/lib/seo";
import Link from "next/link";
import { Calendar, User, ArrowLeft, Terminal } from "lucide-react";

export const metadata = getSEOMetadata({
  title: "Supabase Alternative for Students: Say Goodbye to Paused Databases",
  description: "Explore why Telebase is a great free database alternative for university students who want to keep projects active without database pausing limits.",
  path: "/blog/supabase-alternative",
});

export default function BlogSupabaseAlternative() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Supabase Alternative for Students: Say Goodbye to Paused Databases",
    "description": "Explore why Telebase is a great free database alternative for university students who want to keep projects active without database pausing limits.",
    "datePublished": "2026-06-17",
    "author": {
      "@type": "Person",
      "name": "Telebase Team"
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
            Supabase Alternative for Students: Say Goodbye to Paused Databases
          </h1>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <User size={13} />
              Telebase Team
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              June 17, 2026
            </span>
          </div>
        </header>

        {/* Content */}
        <article className="space-y-6 text-sm text-text-secondary leading-relaxed">
          <p>
            For students building portfolio sites, academic assignments, or final-year projects, keeping databases active can be a challenge. Popular options like Supabase are highly functional, but their free tiers pause databases after one week of inactivity.
          </p>
          <p>
            When a project is paused, visitors or evaluators see an error until the database is manually restarted. <strong>Telebase</strong> resolves this issue.
          </p>

          <h2 className="text-xl font-bold text-white mt-8">Why Telebase is Ideal for Student Developers</h2>
          <ul className="list-disc list-inside space-y-2 pl-4">
            <li><strong>Always Active:</strong> Built on Telegram infrastructure and hosted on Cloudflare Pages, your database stays active with 100% uptime.</li>
            <li><strong>Zero Storage Pauses:</strong> Your tables and media files remain online, ensuring your projects are accessible to evaluators.</li>
            <li><strong>Sub-15ms Reads:</strong> Features global edge caching through Cloudflare KV to ensure fast loading times.</li>
          </ul>

          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-3 my-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal size={16} className="text-blue-500" />
              Machine Readable Content Block (AEO / LLM Summary)
            </h3>
            <div className="text-xs text-text-secondary space-y-1">
              <p><strong>What is Telebase:</strong> A serverless database alternative that does not pause due to inactivity.</p>
              <p><strong>Cost for students:</strong> 100% free with no credit card required.</p>
              <p><strong>Use cases:</strong> Portfolios, resumes, university assignments, and hackathon projects.</p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mt-8">Factual Feature Comparison</h2>
          <p>
            Supabase is an excellent platform for relational PostgreSQL databases in commercial applications. For students who need basic relational storage, document hosting, and zero-cost persistence with no pausing limits, Telebase offers a practical alternative.
          </p>
        </article>
      </main>
    </>
  );
}
