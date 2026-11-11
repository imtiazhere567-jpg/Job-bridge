import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { DialogHost } from "@/components/dialog";

// Montserrat ships with the app (same files the posters use), so headings never fall back.
const montserrat = localFont({
  variable: "--font-montserrat",
  display: "swap",
  src: [
    { path: "../assets/fonts/montserrat-latin-600-normal.woff", weight: "600" },
    { path: "../assets/fonts/montserrat-latin-700-normal.woff", weight: "700" },
    { path: "../assets/fonts/montserrat-latin-800-normal.woff", weight: "800" },
  ],
});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: { default: "JobBridge · Connecting talent to opportunity", template: "%s · JobBridge" },
  description: "Careers at JobBridge. Find your next role and apply in about three minutes.",
  icons: { icon: "/brand/icon.png", apple: "/brand/apple-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (e.g. ColorZilla, Grammarly) add attributes to <html>/<body> before React loads;
    // suppressHydrationWarning stops those harmless differences showing as errors. It only covers these two tags.
    <html lang="en" className={`${montserrat.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <DialogHost />
      </body>
    </html>
  );
}
