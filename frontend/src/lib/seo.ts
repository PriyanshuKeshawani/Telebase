import { Metadata } from "next";

interface SEOOptions {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}

export function getSEOMetadata(options: SEOOptions): Metadata {
  const baseUrl = "https://telebase.pages.dev";
  const canonicalUrl = `${baseUrl}${options.path.startsWith('/') ? options.path : '/' + options.path}`;
  const siteName = "Telebase";

  return {
    title: options.title,
    description: options.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: options.title,
      description: options.description,
      url: canonicalUrl,
      siteName: siteName,
      type: "website",
      images: [
        {
          url: `${baseUrl}/window.svg`,
          width: 800,
          height: 600,
          alt: `${siteName} Console Preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: [`${baseUrl}/window.svg`],
    },
    robots: options.noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
  };
}
