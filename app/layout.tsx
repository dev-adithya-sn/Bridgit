import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import SetupNotice from "@/components/SetupNotice";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Bridge-It — Disaster Response Platform for Jharkhand",
  description:
    "Crowdsourced disaster problem reporting with smart supply-to-need matching. SIH 2026 · PS SIH26043 · Govt. of Jharkhand.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${oswald.variable} ${inter.variable} min-h-screen bg-canvas font-sans text-ink antialiased`}
      >
        <Nav />
        <SetupNotice />
        {/* Pages manage their own containers so full-width black bands can alternate with off-white ones */}
        <main>{children}</main>
        <footer className="border-t border-ink bg-ink py-6 text-center font-display text-xs tracking-wide text-canvas">
          Bridge-It · Smart India Hackathon 2026 · PS SIH26043 · Govt. of Jharkhand
        </footer>
      </body>
    </html>
  );
}
