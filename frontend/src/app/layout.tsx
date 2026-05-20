import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Telebase | Telegram Storage as a Database",
  description: "Connect your Telegram channels to a robust production-ready database layer with API access and guaranteed data integrity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-black text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
