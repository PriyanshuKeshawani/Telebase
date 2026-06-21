"use client";

import { useState } from "react";
import Link from "next/link";
import { Database, Shield, Zap, HardDrive, FileUp, FileDown, Layers, Terminal, Menu, X, Compass } from "lucide-react";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const links = [
    { href: "/docs", label: "Getting Started", icon: Zap },
    { href: "/docs/onboarding", label: "Onboarding & Setup", icon: Compass },
    { href: "/docs/architecture", label: "Architecture", icon: Layers },
    { href: "/docs/authentication", label: "Authentication", icon: Shield },
    { href: "/docs/crud", label: "CRUD Operations", icon: Database },
    { href: "/docs/sql", label: "SQL Queries", icon: Terminal },
    { href: "/docs/nosql", label: "NoSQL Queries", icon: Terminal },
    { href: "/docs/file-upload", label: "File Uploads", icon: FileUp },
    { href: "/docs/file-download", label: "File Downloads", icon: FileDown },
  ];

  return (
    <div className="flex min-h-screen bg-bg-base text-text-primary selection:bg-blue-500/30 font-sans flex-col md:flex-row">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border-subtle bg-bg-surface sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-text-primary text-sm">Telebase Docs</span>
        </Link>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 rounded-lg hover:bg-bg-input text-text-muted hover:text-text-primary transition-colors"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[61px] bg-bg-base z-40 overflow-y-auto p-4">
          <nav className="flex flex-col gap-1">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 px-3 mt-2">Developer Guide</div>
            {links.map(l => (
              <Link 
                key={l.href} 
                href={l.href} 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-bg-input text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
              >
                <l.icon size={16} />
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border-subtle bg-bg-surface p-6 flex-col gap-6 fixed h-full overflow-y-auto hidden md:flex">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-text-primary">Telebase Docs</span>
        </Link>
        <nav className="flex flex-col gap-1 mt-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 px-3">Developer Guide</div>
          {links.map(l => (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-input text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
              <l.icon size={16} />
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-6 md:p-12 lg:p-20 max-w-5xl docs-content">
        <div className="space-y-10">
          {children}
        </div>
      </main>
    </div>
  );
}
