import React from "react";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Privacy Policy - Telebase",
  description: "Read the Privacy Policy of Telebase. Learn how client-side zero-knowledge encryption secures your database details.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-text-primary space-y-8">
      <h1 className="text-3xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
      <p className="text-xs text-text-muted">Last updated: June 21, 2026</p>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Core Privacy Philosophy</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Telebase is an open-source self-hosted tool. We do not operate databases, collect developer credentials, store Telegram bot tokens, or maintain backend servers for your data. Your data flows directly from your client (or your Cloudflare deployment) to Telegram channels.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. Zero-Knowledge Encryption</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          When you enable End-to-End Encryption (AES-256-GCM) inside your Storage Settings:
        </p>
        <ul className="list-disc list-inside text-xs text-text-secondary space-y-1 pl-4">
          <li>Encryption keys are generated and stored strictly client-side (e.g. in your config or dashboard).</li>
          <li>All payloads are encrypted before leaving your application.</li>
          <li>Telegram servers and routers only see unreadable binary blocks.</li>
          <li>We have zero technical capability to decrypt or read your database tables or hosted documents.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. Third-Party Services</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Because Telebase utilizes Telegram channels for persistence and Cloudflare for hosting/caching, your usage is subject to the privacy policies of Telegram Messenger and Cloudflare Inc.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">4. Open Source Transparency</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Since Telebase is 100% open-source, you can review our code repository on GitHub to verify how we handle keys, storage headers, and connection tokens.
        </p>
      </section>
    </main>
  );
}
