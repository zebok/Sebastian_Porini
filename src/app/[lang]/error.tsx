"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const STRINGS = {
  en: {
    title: "Something went wrong.",
    description: "An unexpected error occurred. You can try to recover or return to the homepage.",
    tryAgain: "Try again",
    backHome: "← Back home",
  },
  es: {
    title: "Algo salió mal.",
    description: "Ocurrió un error inesperado. Puedes intentar recuperar la sesión o volver a la página de inicio.",
    tryAgain: "Intentar de nuevo",
    backHome: "← Volver al inicio",
  },
};

export default function Error({ error, reset }: ErrorProps) {
  const pathname = usePathname();
  const lang = pathname?.split("/")[1] === "es" ? "es" : "en";
  const t = STRINGS[lang];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={styles.page}>
      {/* Background decoration */}
      <div style={styles.bgDecor} aria-hidden="true">
        <svg
          viewBox="0 0 200 200"
          style={{ width: "600px", opacity: 0.03 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="100" cy="100" r="80" fill="none" stroke="#2D5BE3" strokeWidth="1" />
          <circle cx="100" cy="100" r="55" fill="none" stroke="#7C3AED" strokeWidth="1" />
          <circle cx="100" cy="100" r="30" fill="none" stroke="#059669" strokeWidth="1" />
        </svg>
      </div>

      <div style={styles.content}>
        {/* Status code */}
        <span style={styles.statusCode}>500</span>

        {/* Title */}
        <h1 style={styles.title}>{t.title}</h1>

        {/* Description */}
        <p style={styles.description}>{t.description}</p>

        {/* Error digest for debugging */}
        {error.digest && (
          <code style={styles.digest}>digest: {error.digest}</code>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <button onClick={reset} style={styles.btnPrimary}>
            {t.tryAgain}
          </button>
          <Link href={`/${lang}`} style={styles.btnSecondary}>
            {t.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--bg, #F9F9F7)",
    fontFamily: "var(--font-inter, Inter, sans-serif)",
    position: "relative",
    overflow: "hidden",
  },
  bgDecor: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  content: {
    textAlign: "center",
    padding: "2rem",
    maxWidth: "520px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
    position: "relative",
    zIndex: 1,
  },
  statusCode: {
    fontFamily: "var(--font-mono, JetBrains Mono, monospace)",
    fontSize: "7rem",
    fontWeight: 700,
    lineHeight: 1,
    color: "var(--accent, #2D5BE3)",
    opacity: 0.15,
    letterSpacing: "-4px",
    userSelect: "none",
  },
  title: {
    fontFamily: "var(--font-serif, Playfair Display, serif)",
    fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
    fontWeight: 700,
    color: "var(--ink, #1A1A18)",
    lineHeight: 1.2,
    margin: 0,
  },
  description: {
    fontSize: "1rem",
    color: "var(--ink-muted, #6B6B65)",
    lineHeight: 1.6,
    margin: 0,
  },
  digest: {
    display: "block",
    fontFamily: "var(--font-mono, JetBrains Mono, monospace)",
    fontSize: "0.75rem",
    color: "var(--ink-muted, #6B6B65)",
    backgroundColor: "var(--bg-subtle, #F0EFE9)",
    padding: "0.4rem 0.8rem",
    borderRadius: "4px",
    border: "1px solid var(--border, #E5E4DC)",
  },
  actions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "0.5rem",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btnPrimary: {
    padding: "0.65rem 1.5rem",
    backgroundColor: "var(--accent, #2D5BE3)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s",
    fontFamily: "inherit",
  },
  btnSecondary: {
    padding: "0.65rem 1.5rem",
    backgroundColor: "transparent",
    color: "var(--ink, #1A1A18)",
    border: "1px solid var(--border, #E5E4DC)",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "border-color 0.2s",
    textDecoration: "none",
    fontFamily: "inherit",
  },
};
