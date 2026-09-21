import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, Footer } from "../components/Chrome";

export const metadata: Metadata = {
  title: "NUGGET — LP intelligence for Robinhood Chain",
  description: "Small signals. Big picture.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&display=swap"
        />
      </head>
      <body>
        <div className="shell">
          <Sidebar />
          <div className="main">
            {children}
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
