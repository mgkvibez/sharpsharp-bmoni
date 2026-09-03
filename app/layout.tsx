import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SharpSharp — diaspora money that lands instantly",
  description:
    "Send money from abroad straight to a Nigerian wallet. Powered by BMONI Embedded stablecoin rails.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
