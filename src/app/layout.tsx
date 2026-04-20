import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import { getTranslations } from "@/lib/i18n";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
});

const t = getTranslations("ru");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_MINI_APP_URL ?? "http://localhost:3000",
  ),
  title: t.metadata.layoutTitle,
  description: t.metadata.layoutDescription,
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${manrope.variable} ${playfair.variable} antialiased`}
    >
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="bg-[var(--app-bg)] text-[var(--app-text)]">
        {children}
      </body>
    </html>
  );
}
