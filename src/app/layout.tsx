import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "@/components/account-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Evidence Locker", template: "%s | Evidence Locker" },
  description:
    "Record, organise and timestamp evidence for a goods or vehicle dispute. Information, not advice.",
  applicationName: "Evidence Locker",
  appleWebApp: { capable: true, title: "Evidence Locker", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f4e79" },
    { media: "(prefers-color-scheme: dark)", color: "#121314" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Evidence Locker
          </Link>
          <Suspense fallback={null}>
            <AccountNav />
          </Suspense>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            Evidence Locker records, organises, timestamps and reminds. It provides information,
            not legal advice. You make every decision about your case.
          </p>
        </footer>
      </body>
    </html>
  );
}
