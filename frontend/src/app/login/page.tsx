import React from "react";
import LoginClient from "@/components/LoginClient";
import { getSEOMetadata } from "@/lib/seo";

export const metadata = getSEOMetadata({
  title: "Sign In - Telebase",
  description: "Securely authenticate using your Telegram identity to access your Telebase database administration panel.",
  path: "/login",
  noIndex: true, // Login page should not be indexed in search results
});

export default function LoginPage() {
  return <LoginClient />;
}
