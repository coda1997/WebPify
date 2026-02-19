import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebPify",
  description: "Phase 1 scaffold for a WebP WASM app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
