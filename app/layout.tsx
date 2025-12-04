import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import Navbar from "./components/Navbar"; // ✅ Important!


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
      </head>

      <body className={`${inter.variable} ${mono.variable}`}>
        {/* ✅ Navbar appears on every page */}
        <Navbar />

        {/* Page Content */}
        <main className="p-4">{children}</main>
      </body>
      
    </html>
  );
}
