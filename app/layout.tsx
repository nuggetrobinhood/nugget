import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, Footer } from "../components/Chrome";
import { Splash } from "../components/Splash";
import { PriceTicker } from "../components/PriceTicker";
import { getTicker } from "../lib/data";

export const metadata: Metadata = {
  title: "NUGGET — LP intelligence for Robinhood Chain",
  description: "Small signals. Big picture.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ticker = await getTicker();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <Splash />
        <div className="shell">
          <Sidebar />
          <div className="main">
            <PriceTicker items={ticker} />
            {children}
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
