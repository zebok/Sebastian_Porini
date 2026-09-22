import Link from "next/link";

export default function NotFound() {
  return (
    <div style={styles.page}>
      {/* Decorative circles — consistent with the Venn/ikigai visual language */}
      <div style={styles.bgDecor} aria-hidden="true">
        <svg
          viewBox="0 0 300 300"
          style={{ width: "560px", opacity: 0.04 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="120" cy="130" r="90" fill="none" stroke="#2D5BE3" strokeWidth="1.5" />
          <circle cx="180" cy="130" r="90" fill="none" stroke="#7C3AED" strokeWidth="1.5" />
          <circle cx="150" cy="180" r="90" fill="none" stroke="#059669" strokeWidth="1.5" />
        </svg>
      </div>

      <div style={styles.content}>
        {/* The 404 number — large, ghosted, monospace */}
        <span style={styles.statusCode} aria-hidden="true">404</span>

        {/* Title */}
        <h1 style={styles.title}>This page doesn&apos;t exist.</h1>

        {/* Subtitle — light mathematical touch */}
        <p style={styles.description}>
          The intersection you were looking for is{" "}
          <em style={{ color: "var(--accent, #2D5BE3)" }}>empty</em>.
          <br />
          But the rest of the portfolio is still here.
        </p>

        {/* Navigation */}
        <div style={styles.actions}>
          <Link href="/en" style={styles.btnPrimary}>
            ← Back home
          </Link>
          <Link href="/es" style={styles.btnSecondary}>
            ← Volver al inicio
          </Link>
        </div>

        {/* Subtle sitemap hint */}
        <nav style={styles.sitemapHint} aria-label="Quick navigation">
          <Link href="/en/how-am-i" style={styles.hintLink}>How Am I</Link>
          <span style={styles.separator}>·</span>
          <Link href="/en/skills" style={styles.hintLink}>Skills</Link>
          <span style={styles.separator}>·</span>
          <Link href="/en/timeline" style={styles.hintLink}>Timeline</Link>
          <span style={styles.separator}>·</span>
          <Link href="/en/projects" style={styles.hintLink}>Projects</Link>
        </nav>
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
    transform: "translate(-50%, -55%)",
    pointerEvents: "none",
  },
  content: {
    textAlign: "center",
    padding: "2rem",
    maxWidth: "540px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
    position: "relative",
    zIndex: 1,
  },
  statusCode: {
    fontFamily: "var(--font-mono, JetBrains Mono, monospace)",
    fontSize: "8rem",
    fontWeight: 700,
    lineHeight: 1,
    color: "var(--accent, #2D5BE3)",
    opacity: 0.12,
    letterSpacing: "-6px",
    userSelect: "none",
  },
  title: {
    fontFamily: "var(--font-serif, Playfair Display, serif)",
    fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
    fontWeight: 700,
    color: "var(--ink, #1A1A18)",
    lineHeight: 1.2,
    margin: 0,
  },
  description: {
    fontSize: "1rem",
    color: "var(--ink-muted, #6B6B65)",
    lineHeight: 1.7,
    margin: 0,
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
    textDecoration: "none",
    fontFamily: "inherit",
    transition: "opacity 0.2s",
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
    textDecoration: "none",
    fontFamily: "inherit",
  },
  sitemapHint: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid var(--border, #E5E4DC)",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  hintLink: {
    fontFamily: "var(--font-mono, JetBrains Mono, monospace)",
    fontSize: "0.75rem",
    color: "var(--ink-muted, #6B6B65)",
    textDecoration: "none",
    transition: "color 0.2s",
  },
  separator: {
    color: "var(--border, #E5E4DC)",
    fontSize: "0.75rem",
  },
};
