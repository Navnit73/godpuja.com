import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Hind, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const hind = Hind({ variable: "--font-hind", subsets: ["latin", "devanagari"], weight: ["400", "500", "600"], display: "swap" });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });

// Mantras and aarti are written in Devanagari (PRD v1.1 §17). Not preloaded: the browser fetches it only for pages that contain such text.
const devanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "500", "600"], display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "GodPuja — Sacred rituals, made simple",
  description: "Book pujas, find blessings and connect with tradition.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${hind.variable} ${jakarta.variable} ${devanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><a href="#main" className="skip-link">Skip to main content</a>{children}</body>
    </html>
  );
}
