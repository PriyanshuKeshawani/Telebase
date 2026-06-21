"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Database, Sun, Moon, Menu, X, ArrowRight } from "lucide-react";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-surface/75 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-text-primary text-base">Telebase</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/docs" className="text-text-secondary hover:text-text-primary transition-colors">
            Docs
          </Link>
          <Link href="/blog" className="text-text-secondary hover:text-text-primary transition-colors">
            Blog
          </Link>
          <div className="relative group">
            <button className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1">
              Compare
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-bg-surface border border-border-subtle rounded-xl shadow-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <Link href="/compare/supabase-vs-telebase" className="block px-4 py-2 hover:bg-bg-input text-text-secondary hover:text-text-primary text-xs font-semibold">
                Supabase vs Telebase
              </Link>
              <Link href="/compare/firebase-vs-telebase" className="block px-4 py-2 hover:bg-bg-input text-text-secondary hover:text-text-primary text-xs font-semibold">
                Firebase vs Telebase
              </Link>
            </div>
          </div>
          <Link href="/about" className="text-text-secondary hover:text-text-primary transition-colors">
            About
          </Link>
          <Link href="/contact" className="text-text-secondary hover:text-text-primary transition-colors">
            Contact
          </Link>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-bg-input text-text-muted hover:text-text-primary transition-colors"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}

          {/* CTA */}
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-md shadow-blue-500/10"
          >
            Go to Dashboard
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-bg-input text-text-muted hover:text-text-primary transition-colors"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-bg-input text-text-muted hover:text-text-primary transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border-subtle bg-bg-surface py-4 px-6 flex flex-col gap-4 animate-fade-in-up">
          <nav className="flex flex-col gap-3 font-medium text-sm">
            <Link href="/docs" onClick={() => setIsMobileMenuOpen(false)} className="text-text-secondary hover:text-text-primary">
              Docs
            </Link>
            <Link href="/blog" onClick={() => setIsMobileMenuOpen(false)} className="text-text-secondary hover:text-text-primary">
              Blog
            </Link>
            <Link href="/compare/supabase-vs-telebase" onClick={() => setIsMobileMenuOpen(false)} className="text-text-secondary hover:text-text-primary pl-3 border-l border-border-subtle text-xs">
              Supabase vs Telebase
            </Link>
            <Link href="/compare/firebase-vs-telebase" onClick={() => setIsMobileMenuOpen(false)} className="text-text-secondary hover:text-text-primary pl-3 border-l border-border-subtle text-xs">
              Firebase vs Telebase
            </Link>
            <Link href="/about" onClick={() => setIsMobileMenuOpen(false)} className="text-text-secondary hover:text-text-primary">
              About
            </Link>
            <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className="text-text-secondary hover:text-text-primary">
              Contact
            </Link>
          </nav>
          <Link
            href="/dashboard"
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-full py-3 bg-blue-600 text-white rounded-lg text-center text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
          >
            Go to Dashboard
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </header>
  );
}
