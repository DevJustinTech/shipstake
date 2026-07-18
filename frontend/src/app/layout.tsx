import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://shipstake.vercel.app"),
  title: "ShipStake",
  description: "Stake MON against your goals. Verified by your GitHub activity.",
  openGraph: {
    title: "ShipStake — stake MON, ship or lose it",
    description:
      "An onchain commitment device: stake MON against a deadline, verified by your GitHub activity. Ship and reclaim it, or your beneficiary takes it.",
    url: "https://shipstake.vercel.app",
    siteName: "ShipStake",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
