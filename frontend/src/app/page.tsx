import React from "react";
import HomeClient from "@/components/HomeClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Telebase - Open Source Backend Powered by Telegram",
  description: "Telebase is an open-source backend platform powered by Telegram infrastructure, designed for students, hackathons and side projects.",
  path: "/",
});

export default function Home() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Telebase",
      "operatingSystem": "All",
      "applicationCategory": "DeveloperApplication",
      "offers": {
        "@type": "Offer",
        "price": "0.00",
        "priceCurrency": "USD"
      },
      "description": "An open-source backend platform that uses Telegram infrastructure for authentication, storage, file management and developer tools, supercharged by Cloudflare edge networks.",
      "softwareVersion": "1.0",
      "author": {
        "@type": "Organization",
        "name": "Telebase",
        "url": "https://telebase.pages.dev"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Telebase",
      "url": "https://telebase.pages.dev",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://telebase.pages.dev/docs?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Telebase?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Telebase is an open-source serverless backend platform that uses Telegram's storage infrastructure for persistent data, supercharged with Cloudflare edge caching for lightning-fast database queries and file management."
          }
        },
        {
          "@type": "Question",
          "name": "How does Telebase work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Telebase uploads your database tables and raw files directly to a private Telegram channel via bots. It uses Cloudflare KV edge database to cache indexes and queries, delivering ultra-fast low-latency read operations."
          }
        },
        {
          "@type": "Question",
          "name": "Is Telebase open source?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, Telebase is 100% open-source under the MIT license, and you can self-host it on Cloudflare Pages for free."
          }
        },
        {
          "@type": "Question",
          "name": "Is Telebase a Firebase or Supabase alternative?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! Telebase serves as a free, open-source serverless alternative to Firebase and Supabase, specifically customized for students, side projects, and hackathons where premium hosting budgets are limited."
          }
        },
        {
          "@type": "Question",
          "name": "Can Telebase store files?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, Telebase can store files of any size by splitting them into 19MB chunks (complying with Telegram bot API limits) and reassembling them dynamically during downloads."
          }
        },
        {
          "@type": "Question",
          "name": "Can Telebase be used with Next.js?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Absolutely. Telebase provides a standard JSON API endpoint that can be queried from any Next.js application, React web app, mobile app, or backend server."
          }
        }
      ]
    }
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-grow pt-16">
          <HomeClient />
        </div>
        <Footer />
      </div>
    </>
  );
}
