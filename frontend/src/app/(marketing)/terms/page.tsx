import React from "react";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Terms of Service - Telebase",
  description: "Read the Terms of Service for Telebase open-source software project.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-text-primary space-y-8">
      <h1 className="text-3xl font-extrabold text-white tracking-tight">Terms of Service</h1>
      <p className="text-xs text-text-muted">Last updated: June 21, 2026</p>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Software License</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Telebase is open-source software distributed under the permissive MIT License. You are free to download, inspect, copy, modify, distribute, and self-host the code for commercial or personal purposes.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. Acceptable Use of Telegram Infrastructure</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Because Telebase leverages Telegram for storage, you must strictly comply with Telegram's Terms of Service and API Guidelines.
        </p>
        <ul className="list-disc list-inside text-xs text-text-secondary space-y-1 pl-4">
          <li>Do not use Telebase to host or distribute illegal files, malware, or copyright-infringing content.</li>
          <li>Do not abuse Telegram API channels to spam or execute denial-of-service attempts.</li>
          <li>We are not responsible for any account bans, bot terminations, or content deletion carried out by Telegram.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. Disclaimer of Warranties</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE.
        </p>
      </section>
    </main>
  );
}
