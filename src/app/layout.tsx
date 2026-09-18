import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Adziga - Marketing Operating System",
    template: "%s - Adziga"
  },
  description:
    "Adziga is an AI-first advertising and marketing operating system. Strategy, campaign execution, lead management, creative library, analytics, and AI assistance - in one place.",
  metadataBase: new URL("https://adziga.in"),
  openGraph: {
    title: "Adziga - Marketing Operating System",
    description:
      "AI-first advertising & marketing operating system for serious teams. Strategy  Campaign  Data  Measurement  Learning.",
    type: "website",
    url: "https://adziga.in"
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}