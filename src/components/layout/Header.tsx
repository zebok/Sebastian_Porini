"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { Dictionary } from "@/lib/i18n";
import { useSPA, SectionType } from "./SPAContext";
import styles from "./Header.module.css";

interface HeaderProps {
  dict: Dictionary;
}

export default function Header({ dict }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const lang = (params?.lang as string) || "en";

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const spa = useSPA();

  const navItems: { label: string; href: string; section: SectionType; suffix?: string }[] = [
    { label: dict.nav.whoAmI, href: `/${lang}/how-am-i`, section: "how-am-i" },
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

  return (
    <header className={styles.header}>
      <div className={`${styles.navContainer} container`}>
        <Link 
          href={`/${lang}`} 
          className={styles.logo} 
          onClick={(e) => handleNavClick(e, `/${lang}`, "how-am-i")}
        >
          SP<span className={styles.logoDot}>.</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className={styles.navMenu}>
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
          <LanguageSwitcher />
          <button
            className={styles.mobileToggle}
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className={styles.mobileDrawer}>
          <nav className={styles.mobileNav}>
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
          </nav>
        </div>
      )}
    </header>
  );
}
