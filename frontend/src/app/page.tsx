import React from "react";
import HomeClient from "@/components/HomeClient";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Telebase - Open Source Backend Powered by Telegram",
  description: "Telebase is an open-source backend platform that uses Telegram infrastructure for authentication, storage and developer tools.",
  path: "/",
});

export default function Home() {
  const jsonLd = {
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
    "description": "An open-source backend platform that uses Telegram infrastructure for authentication, storage and developer tools, supercharged by Cloudflare edge networks.",
    "softwareVersion": "1.0",
    "author": {
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
      <HomeClient />
    </>
  );
}
