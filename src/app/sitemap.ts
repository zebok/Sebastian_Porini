import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = ["en", "es"];
  const sections = ["", "about", "skills", "timeline", "projects"];
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of languages) {
    for (const section of sections) {
      const path = section ? `/${section}` : "";
      entries.push({
        url: `${SITE_URL}/${lang}${path}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: section === "" ? 1.0 : 0.8,
        alternates: {
          languages: {
            en: `${SITE_URL}/en${path}`,
            es: `${SITE_URL}/es${path}`,
          },
        },
      });
    }
  }

  return entries;
}
