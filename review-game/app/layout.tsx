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
  title: "Review Game | Jeopardy-Style Review for Teachers",
  description:
    "Create interactive Jeopardy-style review games for your classroom. Free to start — no setup required.",
  openGraph: {
    title: "Review Game | Jeopardy-Style Review for Teachers",
    description:
      "Create interactive Jeopardy-style review games for your classroom. Free to start — no setup required.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Review Game | Jeopardy-Style Review for Teachers",
    description:
      "Create interactive Jeopardy-style review games for your classroom. Free to start — no setup required.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
