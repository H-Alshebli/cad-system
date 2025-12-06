import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import Navbar from "./components/Navbar";

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
        {/* Leaflet Map Styles */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />

        {/* Enable both dark & light mode */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </head>

      <body
        className={`
          ${inter.variable} 
          ${mono.variable} 
          bg-gray-100 text-gray-900 
          dark:bg-gray-900 dark:text-gray-100
        `}
      >
        <Navbar />

        {/* Page Content */}
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
