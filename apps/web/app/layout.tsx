import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learn Power Platform — Mastery Gate",
  description:
    "An adaptive PL-400 course that coaches Power Platform developers to mastery through a governed lesson, practice, and tool-roster loop.",
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
