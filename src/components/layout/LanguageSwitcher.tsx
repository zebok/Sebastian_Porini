"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./LanguageSwitcher.module.css";

export default function LanguageSwitcher() {
  const pathname = usePathname();

  // Parse path to find current language prefix
  const segments = pathname.split("/");
  const currentLang = segments[1] === "es" ? "es" : segments[1] === "de" ? "de" : "en";
  
  // Reconstruct path for all supported languages
  const restOfPath = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "";
  const pathToEn = `/en${restOfPath}`;
  const pathToEs = `/es${restOfPath}`;
  const pathToDe = `/de${restOfPath}`;

  const langs = [
    { code: "en", label: "EN", href: pathToEn },
    { code: "es", label: "ES", href: pathToEs },
    { code: "de", label: "DE", href: pathToDe },
  ];

  return (
    <div className={styles.switcher}>
      {langs.map((l, index) => (
        <span key={l.code}>
          {index > 0 && <span className={styles.divider}>/</span>}
          {currentLang === l.code ? (
            <span className={`${styles.langBtn} ${styles.active}`}>{l.label}</span>
          ) : (
            <Link href={l.href} className={styles.langBtn}>
              {l.label}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}

