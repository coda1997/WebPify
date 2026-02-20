import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WebPify - Fast Local WebP Converter",
  description: "Convert images to WebP locally in your browser with fast, private processing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="antialiased text-slate-900 bg-slate-50">{children}</body>
    </html>
  );
}
