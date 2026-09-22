import type { Metadata } from "next";
import SPALayout from "@/components/layout/SPALayout";
import { getDictionary } from "@/lib/i18n";
import { getLocalizedData } from "@/lib/data";
import { SectionType } from "@/components/layout/SPAContext";

interface PageProps {
  params: Promise<{
    lang: string;
    slug?: string[];
  }>;
}

// Generate static routes at build time for optimal performance and SEO
export async function generateStaticParams() {
  const paths: { lang: string; slug?: string[] }[] = [];
  const locales = ["en", "es", "de"];
  const sections = ["how-am-i", "skills", "timeline", "projects"];

  for (const lang of locales) {
    // Index path (home) /en, /es, /de
    paths.push({ lang, slug: undefined });
    
    // Sub-routes /en/skills, /es/projects, /de/timeline etc.
    for (const section of sections) {
      paths.push({ lang, slug: [section] });
    }
  }
  return paths;
}

// Dynamic SEO metadata based on active path
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const lang = resolvedParams?.lang || "en";
  const slug = resolvedParams?.slug;
  const section = slug && slug.length > 0 ? (slug[0] as SectionType) : "how-am-i";

  const data = getLocalizedData(lang);
  const dict = getDictionary(lang);
  const name = data.personal.name;

  let title = name;
  let description = data.personal.description;

  if (slug && slug.length > 0) {
    switch (section) {
      case "how-am-i":
        title = `${dict.whoAmI.title} — ${name}`;
        description = dict.whoAmI.subtitle;
        break;
      case "skills":
        title = `${dict.skills.title} — ${name}`;
        description = dict.skills.subtitle;
        break;
      case "timeline":
        title = `${dict.timeline.title} — ${name}`;
        description = dict.timeline.subtitle;
        break;
      case "projects":
        title = `${dict.projects.title} — ${name}`;
        description = dict.projects.metaDescription;
        break;
    }
  }

  const sectionPath = slug && slug.length > 0 ? `/${slug[0]}` : "";
  const localeString = lang === "es" ? "es_AR" : lang === "de" ? "de_DE" : "en_US";

  return {
    title,
    description,
    alternates: {
      canonical: `https://sebastianporini.com/${lang}${sectionPath}`,
      languages: {
        en: `https://sebastianporini.com/en${sectionPath}`,
        es: `https://sebastianporini.com/es${sectionPath}`,
        de: `https://sebastianporini.com/de${sectionPath}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `https://sebastianporini.com/${lang}${sectionPath}`,
      locale: localeString,
      type: "website",
    },
  };
}

export default async function CatchAllEntry({ params }: PageProps) {
  const resolvedParams = await params;
  const lang = resolvedParams?.lang || "en";
  const slug = resolvedParams?.slug;
  
  // Set initialSection based on slug parameter (how-am-i is fallback)
  const initialSection = slug && slug.length > 0 ? (slug[0] as SectionType) : "how-am-i";

  const dict = getDictionary(lang);
  const data = getLocalizedData(lang);

  return (
    <SPALayout
      lang={lang}
      dict={dict}
      data={data}
      initialSection={initialSection}
    />
  );
}
