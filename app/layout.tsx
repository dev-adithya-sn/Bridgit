import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import SetupNotice from "@/components/SetupNotice";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SahayataSetu — Disaster Response Platform for Jharkhand",
  description:
    "Crowdsourced disaster problem reporting with smart supply-to-need matching. SIH 2026 · PS SIH26043 · Govt. of Jharkhand.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.className} min-h-screen bg-slate-50 text-slate-900 antialiased`}>
        <Nav />
        <SetupNotice />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          SahayataSetu · Smart India Hackathon 2026 · PS SIH26043 · Govt. of Jharkhand
        </footer>
      </body>
    </html>
  );
}
