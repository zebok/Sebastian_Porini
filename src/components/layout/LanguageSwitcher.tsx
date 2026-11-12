"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./LanguageSwitcher.module.css";

export default function LanguageSwitcher() {
  const pathname = usePathname();

  const segments = pathname.split("/");
  const currentLang = segments[1] === "es" ? "es" : "en";

  const restOfPath = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "";
  const langs = [
    { code: "en", label: "EN", href: `/en${restOfPath}` },
    { code: "es", label: "ES", href: `/es${restOfPath}` },
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
