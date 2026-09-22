import { getLocalizedData } from "@/lib/data";
import { Dictionary } from "@/types/content";

export type SupportedLang = "en" | "es" | "de";
export const SUPPORTED_LANGS: SupportedLang[] = ["en", "es", "de"];

export const isSupportedLang = (lang: string): lang is SupportedLang => {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
};

export const getDictionary = (lang: string): Dictionary => {
  const data = getLocalizedData(lang);
  return data.ui;
};

export type { Dictionary };
