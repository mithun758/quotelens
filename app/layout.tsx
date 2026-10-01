import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

// One family, two weights.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "QuoteLens",
  description: "Kill the Quote Spreadsheet: a Quote Comparison prototype for Meridian Diagnostics",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${publicSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
