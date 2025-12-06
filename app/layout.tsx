import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "./components/Navbar"; // <-- MAKE SURE THIS PATH IS CORRECT

const inter = Inter({
  subsets: ["latin"],
});

export const metadata = {
  title: "CAD System",
  description: "Emergency Dispatch System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          precedence="default"
        />
      </head>

      <body className={inter.className}>
        {/* ✅ NAVBAR ALWAYS ON TOP */}
        <Navbar />

        {/* MAIN CONTENT */}
        <main className="p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
