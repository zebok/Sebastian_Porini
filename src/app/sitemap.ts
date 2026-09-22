import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://sebastianporini.com";
  const languages = ["en", "es", "de"];
  const sections = ["", "how-am-i", "skills", "timeline", "projects"];
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of languages) {
    for (const section of sections) {
      const path = section ? `/${section}` : "";
      entries.push({
        url: `${baseUrl}/${lang}${path}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: section === "" ? 1.0 : 0.8,
        alternates: {
          languages: {
            en: `${baseUrl}/en${path}`,
            es: `${baseUrl}/es${path}`,
            de: `${baseUrl}/de${path}`,
          },
        },
      });
    }
  }

  return entries;
}
