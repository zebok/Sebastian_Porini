import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono, Inter } from "next/font/google";
import GridOverlay from "@/components/effects/GridOverlay";
import { getLocalizedData } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import "../globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

type Props = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const lang = resolvedParams?.lang === "es" ? "es" : "en";
  const data = getLocalizedData(lang);
  const name = data.personal.name;
  const description = data.personal.description;
  const localeString = lang === "es" ? "es_AR" : "en_US";

  return {
    title: {
      default: `${name} — ${data.personal.tagline}`,
      template: `%s — ${name}`,
    },
    description: description,
    metadataBase: new URL(`${SITE_URL}/`),
    alternates: {
      canonical: `${SITE_URL}/${lang}`,
      languages: {
        en: `${SITE_URL}/en`,
        es: `${SITE_URL}/es`,
      },
    },
    openGraph: {
      title: `${name} — ${data.personal.tagline}`,
      description: description,
      url: `${SITE_URL}/${lang}`,
      siteName: name,
      images: [
        {
          url: `${SITE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: `${name} — ${data.personal.tagline}`,
        },
      ],
      locale: localeString,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — ${data.personal.tagline}`,
      description: description,
      images: [`${SITE_URL}/og-image.png`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "es" }];
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const resolvedParams = await params;
  const lang = resolvedParams?.lang === "es" ? "es" : "en";
  const data = getLocalizedData(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": data.personal.name,
    "url": SITE_URL,
    "jobTitle": data.personal.tagline,
    "description": data.personal.description,
    "sameAs": [
      data.personal.contactDetails.github,
      data.personal.contactDetails.linkedin,
    ],
  };

  const skipLabel =
    lang === "es" ? "Saltar al contenido principal" : "Skip to main content";

  return (
    <html lang={lang}>
      <body className={`${playfair.variable} ${jetbrainsMono.variable} ${inter.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main-content" className="skip-link">
          {skipLabel}
        </a>
        <GridOverlay />
        {children}
      </body>
    </html>
  );
}
