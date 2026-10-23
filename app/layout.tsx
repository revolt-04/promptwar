import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EcoAction AI — Intelligent Sustainability Decision Assistant",
  description: "Evaluate, rank, and execute high-impact waste-reduction and energy-saving actions for households and small businesses. Powered by Google Gemini and explainable multi-criteria decision rules.",
  keywords: ["sustainability", "energy saving", "waste reduction", "Gemini AI", "decision assistant", "eco action"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#081110] text-[#f1f7f5] antialiased">
        {children}
      </body>
    </html>
  );
}
