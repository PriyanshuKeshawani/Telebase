"use client";

import React from "react";
import Link from "next/link";
import { Database, Github, Twitter, MessageSquare } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-bg-surface py-12 px-6 transition-colors">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand Info */}
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-text-primary text-base">Telebase</span>
          </Link>
          <p className="text-xs text-text-muted leading-relaxed max-w-sm">
            Telebase is an open-source serverless backend platform that repurposes Telegram infrastructure into a secure, infinite persistence layer for distributed apps.
          </p>
          <div className="flex items-center gap-4 text-text-muted">
            <a href="https://github.com/PriyanshuKeshawani/Telebase" target="_blank" rel="noreferrer" className="hover:text-text-primary transition-colors">
              <Github size={18} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:text-text-primary transition-colors">
              <Twitter size={18} />
            </a>
            <a href="https://t.me/+mSyoFxg97MIwNGZl" target="_blank" rel="noreferrer" className="hover:text-text-primary transition-colors">
              <MessageSquare size={18} />
            </a>
          </div>
        </div>

        {/* Resources */}
        <div>
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4">Resources</h4>
          <ul className="space-y-2 text-xs text-text-secondary">
            <li>
              <Link href="/docs" className="hover:text-text-primary transition-colors">Documentation</Link>
            </li>
            <li>
              <Link href="/docs/onboarding" className="hover:text-text-primary transition-colors">Onboarding Guide</Link>
            </li>
            <li>
              <Link href="/docs/architecture" className="hover:text-text-primary transition-colors">Architecture Overview</Link>
            </li>
            <li>
              <Link href="/docs/sql" className="hover:text-text-primary transition-colors">SQL Interface Reference</Link>
            </li>
          </ul>
        </div>

        {/* Compare & Alternatives */}
        <div>
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4">Compare</h4>
          <ul className="space-y-2 text-xs text-text-secondary">
            <li>
              <Link href="/compare/supabase-vs-telebase" className="hover:text-text-primary transition-colors">Supabase vs Telebase</Link>
            </li>
            <li>
              <Link href="/compare/firebase-vs-telebase" className="hover:text-text-primary transition-colors">Firebase vs Telebase</Link>
            </li>
            <li>
              <Link href="/blog/supabase-alternative" className="hover:text-text-primary transition-colors">Supabase Alternative for Students</Link>
            </li>
            <li>
              <Link href="/blog/firebase-alternative" className="hover:text-text-primary transition-colors">Firebase Alternative for Hackathons</Link>
            </li>
          </ul>
        </div>

        {/* Legal & Product */}
        <div>
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4">Company</h4>
          <ul className="space-y-2 text-xs text-text-secondary">
            <li>
              <Link href="/about" className="hover:text-text-primary transition-colors">About Us</Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-text-primary transition-colors">Contact Support</Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-text-primary transition-colors">Terms of Service</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-border-subtle flex flex-col md:flex-row items-center justify-between text-[11px] text-text-muted">
        <p>© {new Date().getFullYear()} Telebase. All rights reserved. Open source under MIT license.</p>
        <p className="mt-2 md:mt-0">Designed for developers, hackers, and students.</p>
      </div>
    </footer>
  );
}
