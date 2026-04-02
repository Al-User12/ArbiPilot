import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ArbiPilot",
  description: "Arbitrum-native Explain-Then-Execute AI swap agent (Arbitrum Sepolia)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full font-sans bg-[#09090b] text-[#f4f4f5] selection:bg-cyan-500/30 selection:text-cyan-50">
        {children}
      </body>
    </html>
  );
}

