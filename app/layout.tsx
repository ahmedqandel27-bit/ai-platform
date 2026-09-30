import type { Metadata, Viewport } from "next";
import { Cinzel, Amiri, IBM_Plex_Sans_Arabic, Instrument_Serif, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { localeDirection, type Locale } from "@/i18n/config";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});
// Display faces: an editorial serif (with italic) for headlines and numerals,
// and a classical naskh for Arabic headlines.
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display-latin",
  display: "swap",
});
const displayArabic = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-display-arabic",
  display: "swap",
});

const brand = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-brand",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#050309",
  colorScheme: "dark",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  robots: { index: false, follow: false }, // private workspace
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  openGraph: { title: APP_NAME, description: APP_TAGLINE, type: "website" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;

  return (
    <html lang={locale} dir={localeDirection[locale]} className={`${inter.variable} ${arabic.variable} ${display.variable} ${displayArabic.variable} ${brand.variable}`}>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
