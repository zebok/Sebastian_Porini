import { Dictionary } from "@/lib/i18n";
import type { LocalizedPortfolioData } from "@/lib/data";
import styles from "./Footer.module.css";

interface FooterProps {
  dict: Dictionary;
  personal: LocalizedPortfolioData["personal"];
  lang?: string;
}

export default function Footer({ dict, personal, lang = "en" }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const { contactDetails, name } = personal;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const cleanBasePath = basePath.replace(/\/$/, "");
  const cleanCvPath = (contactDetails.cvPath || "/SebastianPorini_English.pdf").startsWith("/")
    ? (contactDetails.cvPath || "/SebastianPorini_English.pdf")
    : `/${contactDetails.cvPath}`;
  const cvUrl = `${cleanBasePath}${cleanCvPath}`;

  const downloadFilename =
    lang === "es"
      ? "Sebastian_Porini_CV_ES.pdf"
      : lang === "de"
      ? "Sebastian_Porini_Lebenslauf_DE.pdf"
      : "Sebastian_Porini_CV_EN.pdf";

  return (
    <footer className={styles.footer}>
      <div className={`${styles.footerContainer} container`}>
        <div className={styles.leftSection}>
          <div className={styles.copyright}>
            © {currentYear} {name} <span style={{ opacity: 0.5 }}>|</span> {dict.footer.tagline}
          </div>
        </div>

        <div className={styles.rightSection}>
          <a
            href={`mailto:${contactDetails.email}`}
            className={styles.socialLink}
            aria-label="Email"
            title="Email"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span className={styles.linkLabel}>{contactDetails.email}</span>
          </a>

          <a
            href={cvUrl}
            download={downloadFilename}
            className={styles.socialLink}
            aria-label={dict.contact.downloadCv}
            title={`${dict.contact.downloadCv} (PDF)`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 9H8" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
            </svg>
            <span className={styles.linkLabel}>{dict.contact.downloadCv}</span>
          </a>

          <a
            href={contactDetails.github}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
            aria-label="GitHub"
            title="GitHub"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </a>

          <a
            href={contactDetails.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
            aria-label="LinkedIn"
            title="LinkedIn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect width="4" height="12" x="2" y="9" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
