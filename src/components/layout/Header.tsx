"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Menu, X, FileDown } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { Dictionary } from "@/lib/i18n";
import { getCvDownloadInfo } from "@/lib/cv";
import { useSPA, SectionType } from "./SPAContext";
import styles from "./Header.module.css";

interface HeaderProps {
  dict: Dictionary;
  cvPath?: string;
}

export default function Header({ dict, cvPath }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const lang = params?.lang === "es" ? "es" : "en";

  const { url: activeCvUrl, filename: downloadFilename } = getCvDownloadInfo(
    cvPath,
    lang
  );

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const spa = useSPA();

  const navItems: { label: string; href: string; section: SectionType; suffix?: string }[] = [
    { label: dict.nav.whoAmI, href: `/${lang}/about`, section: "about" },
    { label: dict.nav.skills, href: `/${lang}/skills`, section: "skills" },
    { label: dict.nav.timeline, href: `/${lang}/timeline`, section: "timeline" },
    { label: dict.nav.projects, href: `/${lang}/projects`, section: "projects" },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, section: SectionType) => {
    if (spa) {
      e.preventDefault();
      spa.setActiveSection(section);
      closeMenu();
    } else {
      closeMenu();
      if (pathname === href) {
        router.refresh();
      }
    }
  };

  const isItemActive = (href: string, section: SectionType) => {
    if (spa) {
      return spa.activeSection === section;
    }
    return pathname === href;
  };

  const toggleMenuLabel =
    lang === "es"
      ? isOpen
        ? "Cerrar menú"
        : "Abrir menú"
      : isOpen
      ? "Close menu"
      : "Open menu";

  return (
    <header className={styles.header}>
      <div className={`${styles.navContainer} container`}>
        <Link
          href={`/${lang}`}
          className={styles.logo}
          onClick={(e) => handleNavClick(e, `/${lang}`, "about")}
        >
          SP<span className={styles.logoDot}>.</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className={styles.navMenu} aria-label={lang === "es" ? "Navegación principal" : "Main navigation"}>
          <ul className={styles.navList}>
            {navItems.map((item) => {
              const isActive = isItemActive(item.href, item.section);
              return (
                <li key={item.href} className={styles.navItem}>
                  <Link
                    href={item.href}
                    className={`${isActive ? styles.active : ""}`}
                    onClick={(e) => handleNavClick(e, item.href, item.section)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className={styles.linkLabel}>{item.label}</span>
                    {item.suffix && <span className={styles.suffix}>{item.suffix}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.rightSection}>
          <a
            href={activeCvUrl}
            download={downloadFilename}
            className={styles.cvDownloadBtn}
            aria-label={dict.contact.downloadCv}
            title={`${dict.contact.downloadCv} (PDF)`}
          >
            <FileDown size={14} className={styles.cvIcon} />
            <span className={styles.cvBtnLabel}>{dict.contact.downloadCv}</span>
            <span className={styles.pdfBadge}>PDF</span>
          </a>

          <LanguageSwitcher />

          <button
            type="button"
            className={styles.mobileToggle}
            onClick={toggleMenu}
            aria-label={toggleMenuLabel}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className={styles.mobileDrawer}>
          <nav className={styles.mobileNav} aria-label={lang === "es" ? "Navegación móvil" : "Mobile navigation"}>
            {navItems.map((item) => {
              const isActive = isItemActive(item.href, item.section);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.mobileLink} ${isActive ? styles.active : ""}`}
                  onClick={(e) => handleNavClick(e, item.href, item.section)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                  {item.suffix && <span className={styles.suffix}> {item.suffix}</span>}
                </Link>
              );
            })}
            <a
              href={activeCvUrl}
              download={downloadFilename}
              className={styles.mobileCvBtn}
              onClick={closeMenu}
            >
              <FileDown size={18} />
              <span>{dict.contact.downloadCv}</span>
              <span className={styles.mobilePdfBadge}>PDF</span>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
