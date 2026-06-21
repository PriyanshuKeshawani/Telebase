import React from "react";
import Link from "next/link";
import { getSEOMetadata } from "@/lib/seo";
import { BookOpen, Calendar, ArrowRight, User } from "lucide-react";

export const metadata = getSEOMetadata({
  title: "Telebase Blog - Serverless Backend Guides & Alternatives",
  description: "Read the latest tutorials, comparisons, and backend architecture guides for Telebase. Learn how to use Telegram as a database layer.",
  path: "/blog",
});

const articles = [
  {
    slug: "what-is-telebase",
    title: "What is Telebase? A Deep Dive into the Serverless Telegram Database Layer",
    description: "Learn how Telebase repurposes Telegram channels into a globally replicated serverless database layer using Cloudflare KV edge networks.",
    tag: "Guides",
    date: "June 21, 2026",
    author: "Priyanshu Keshawani",
  },
  {
    slug: "firebase-alternative",
    title: "Firebase Alternative for Hackathons: Build for Free with Telebase",
    description: "Tired of usage caps and credit card requirements at hackathons? Discover why Telebase is the ultimate zero-cost Firebase alternative.",
    tag: "Alternatives",
    date: "June 19, 2026",
    author: "Telebase Team",
  },
  {
    slug: "supabase-alternative",
    title: "Supabase Alternative for Students: Say Goodbye to Paused Databases",
    description: "Explore why Telebase is a great free database alternative for university students who want to keep projects active without database pausing limits.",
    tag: "Alternatives",
    date: "June 17, 2026",
    author: "Telebase Team",
  },
  {
    slug: "telegram-as-database",
    title: "How to Use Telegram as a Database: Storage Limits, Bots, and Edge Caching",
    description: "A technical walkthrough explaining Telegram's internal attachment systems, bot endpoints, and how edge caching enables low-latency queries.",
    tag: "Database",
    date: "June 14, 2026",
    author: "Priyanshu Keshawani",
  },
  {
    slug: "backend-for-students",
    title: "The Ultimate Free Backend for College & Student Software Projects",
    description: "Skip expensive VPS configurations. Learn how college students can leverage Telebase to deploy portfolios and final-year web apps for free.",
    tag: "Students",
    date: "June 10, 2026",
    author: "Developer Community",
  },
  {
    slug: "backend-for-hackathons",
    title: "Why Telebase is the Best Free Backend Option for Hackathon Teams",
    description: "Speed up your hackathon submissions. Set up authentication, SQL databases, and file explorer tools in less than 5 minutes.",
    tag: "Hackathons",
    date: "June 05, 2026",
    author: "Hackathon Lead",
  },
];

export default function BlogListingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Telebase Blog",
    "description": "Read the latest tutorials, comparisons, and backend architecture guides for Telebase.",
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
      <main className="max-w-5xl mx-auto px-6 py-16 text-text-primary space-y-12">
        {/* Header */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight flex items-center justify-center gap-3">
            <BookOpen className="text-blue-500 w-8 h-8 md:w-10 md:h-10" />
            Telebase Blog
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed">
            Developer guides, tutorials, design architectures, and comparison reviews written for modern developers.
          </p>
        </section>

        {/* Blog Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {articles.map((article) => (
            <article
              key={article.slug}
              className="p-6 rounded-2xl bg-bg-surface border border-border-subtle hover:border-blue-500/30 transition-all flex flex-col justify-between space-y-4 group shadow-sm hover:shadow-lg"
            >
              <div className="space-y-3">
                {/* Meta & Tag */}
                <div className="flex items-center gap-3 text-[10px] font-bold tracking-wider uppercase text-text-muted">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/10">
                    {article.tag}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {article.date}
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-lg font-bold text-white group-hover:text-blue-500 transition-colors line-clamp-2">
                  <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                </h2>

                {/* Description */}
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                  {article.description}
                </p>
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-between pt-4 border-t border-border-subtle text-xs text-text-muted mt-auto">
                <span className="flex items-center gap-1.5 font-medium">
                  <User size={13} className="text-text-muted" />
                  {article.author}
                </span>
                <Link
                  href={`/blog/${article.slug}`}
                  className="text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1 group/btn text-[11px]"
                >
                  Read Article
                  <ArrowRight size={12} className="transform group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
