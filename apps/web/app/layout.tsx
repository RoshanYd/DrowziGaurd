import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DrowsiGuard — Real-Time Driver Fatigue Monitor",
  description:
    "AI-powered drowsiness detection system using edge computing and real-time facial analysis to keep drivers safe on the road.",
  keywords: [
    "drowsiness detection",
    "driver safety",
    "fatigue monitoring",
    "AI",
    "real-time",
    "fleet management",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <head>
        <script src="/env-shim.js" />
        <meta name="theme-color" content="#0a0e1a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full flex flex-col bg-[hsl(222,47%,4%)] text-white">
        {children}
      </body>
    </html>
  );
}
