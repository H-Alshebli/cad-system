import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import AppShell from "./components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CAD System",
  description: "Emergency Dispatch System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </head>

      <body
        className={`
          ${inter.variable}
          ${mono.variable}
          bg-gray-100 text-gray-900
          dark:bg-[#050814] dark:text-gray-100
        `}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}