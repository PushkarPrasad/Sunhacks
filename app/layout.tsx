import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument-serif" });
const sans = Geist({ subsets: ["latin"], variable: "--font-inter" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: `${BRAND.name} · ${BRAND.tagline}`,
  description: BRAND.description,
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#06100C", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }} className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
