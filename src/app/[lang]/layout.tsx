import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono, Inter } from "next/font/google";
import GridOverlay from "@/components/effects/GridOverlay";
import { getLocalizedData } from "@/lib/data";
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
  const lang = resolvedParams?.lang || "en";
  const data = getLocalizedData(lang);
  const name = data.personal.name;
  const description = data.personal.description;

  const localeString = lang === "es" ? "es_AR" : lang === "de" ? "de_DE" : "en_US";

  return {
    title: {
      default: `${name}`,
      template: `%s — ${name}`,
    },
    description: description,
    metadataBase: new URL("https://sebastianporini.com"),
    alternates: {
      canonical: `https://sebastianporini.com/${lang}`,
      languages: {
        en: "https://sebastianporini.com/en",
        es: "https://sebastianporini.com/es",
        de: "https://sebastianporini.com/de",
      },
    },
    openGraph: {
      title: `${name}`,
      description: description,
      url: `https://sebastianporini.com/${lang}`,
      siteName: name,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `${name}`,
        },
      ],
      locale: localeString,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name}`,
      description: description,
      images: ["/og-image.png"],
      creator: "@sebiporini",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "es" }, { lang: "de" }];
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const resolvedParams = await params;
  const lang = resolvedParams?.lang || "en";
  const data = getLocalizedData(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": data.personal.name,
    "url": "https://sebastianporini.com",
    "jobTitle": data.personal.tagline,
    "description": data.personal.description,
    "sameAs": [
      data.personal.contactDetails.github,
      data.personal.contactDetails.linkedin,
    ],
  };

  return (
    <html lang={lang}>
      <body className={`${playfair.variable} ${jetbrainsMono.variable} ${inter.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <GridOverlay />
        {children}
      </body>
    </html>
  );
}

