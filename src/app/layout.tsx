import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Linkr - Premium URL Shortener",
  description: "Shorten URLs, manage custom domains, and track analytics.",
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
