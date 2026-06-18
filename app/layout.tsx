import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Create-Wiki",
  description:
    "The AI-generated encyclopedia. Every article is written the moment you look for it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
