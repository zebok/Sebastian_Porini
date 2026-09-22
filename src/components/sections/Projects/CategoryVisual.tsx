import styles from "./Projects.module.css";

interface CategoryVisualProps {
  category: string;
}

export const CategoryVisual = ({ category }: CategoryVisualProps) => {
  switch (category) {
    case "software":
      return (
        <svg viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.svgGrid}>
          <rect x="20" y="20" width="360" height="140" rx="6" fill="#1A1A18" fillOpacity="0.02" stroke="var(--border)" strokeWidth="1" />
          <rect x="35" y="35" width="330" height="110" rx="4" fill="#1A1A18" fillOpacity="0.95" />
          <circle cx="55" cy="50" r="4" fill="#EF4444" />
          <circle cx="70" cy="50" r="4" fill="#F59E0B" />
          <circle cx="85" cy="50" r="4" fill="#10B981" />
          <rect x="55" y="70" width="120" height="6" rx="3" fill="var(--accent)" fillOpacity="0.8" />
          <rect x="55" y="85" width="220" height="6" rx="3" fill="#ffffff" fillOpacity="0.7" />
          <rect x="75" y="100" width="180" height="6" rx="3" fill="var(--accent-2)" fillOpacity="0.8" />
          <rect x="75" y="115" width="90" height="6" rx="3" fill="#10B981" fillOpacity="0.8" />
        </svg>
      );
    case "data":
      return (
        <svg viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="20" width="360" height="140" rx="6" fill="#1A1A18" fillOpacity="0.02" stroke="var(--border)" strokeWidth="1" />
          <line x1="50" y1="40" x2="350" y2="40" stroke="var(--border)" strokeWidth="0.5" />
          <line x1="50" y1="80" x2="350" y2="80" stroke="var(--border)" strokeWidth="0.5" />
          <line x1="50" y1="120" x2="350" y2="120" stroke="var(--border)" strokeWidth="0.5" />
          <line x1="50" y1="30" x2="50" y2="140" stroke="var(--ink)" strokeWidth="1" />
          <line x1="45" y1="140" x2="360" y2="140" stroke="var(--ink)" strokeWidth="1" />
          <rect x="80" y="90" width="25" height="50" rx="2" fill="var(--accent)" fillOpacity="0.1" stroke="var(--accent)" strokeWidth="1" />
          <rect x="140" y="60" width="25" height="80" rx="2" fill="var(--accent)" fillOpacity="0.1" stroke="var(--accent)" strokeWidth="1" />
          <rect x="200" y="75" width="25" height="65" rx="2" fill="var(--accent)" fillOpacity="0.1" stroke="var(--accent)" strokeWidth="1" />
          <rect x="260" y="45" width="25" height="95" rx="2" fill="var(--accent)" fillOpacity="0.1" stroke="var(--accent)" strokeWidth="1" />
          <path d="M93 105 L153 65 L213 85 L273 50" fill="none" stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="93" cy="105" r="5" fill="#ffffff" stroke="var(--accent-2)" strokeWidth="2.5" />
          <circle cx="153" cy="65" r="5" fill="#ffffff" stroke="var(--accent-2)" strokeWidth="2.5" />
          <circle cx="213" cy="85" r="5" fill="#ffffff" stroke="var(--accent-2)" strokeWidth="2.5" />
          <circle cx="273" cy="50" r="5" fill="#ffffff" stroke="var(--accent-2)" strokeWidth="2.5" />
        </svg>
      );
    case "ai":
      return (
        <svg viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.svgNodes}>
          <rect x="20" y="20" width="360" height="140" rx="6" fill="#1A1A18" fillOpacity="0.02" stroke="var(--border)" strokeWidth="1" />
          <line x1="80" y1="90" x2="160" y2="55" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="80" y1="90" x2="160" y2="125" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="160" y1="55" x2="240" y2="55" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="160" y1="125" x2="240" y2="125" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="160" y1="125" x2="240" y2="55" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="160" y1="55" x2="240" y2="125" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="240" y1="55" x2="320" y2="90" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="240" y1="125" x2="320" y2="90" stroke="var(--border)" strokeWidth="1.5" />
          <circle cx="80" cy="90" r="8" fill="var(--accent)" />
          <circle cx="160" cy="55" r="8" fill="var(--accent-2)" />
          <circle cx="160" cy="125" r="8" fill="var(--accent-2)" />
          <circle cx="240" cy="55" r="8" fill="var(--accent-2)" />
          <circle cx="240" cy="125" r="8" fill="var(--accent-2)" />
          <circle cx="320" cy="90" r="10" fill="var(--accent-3)" />
          <circle cx="320" cy="90" r="15" stroke="var(--accent-3)" strokeWidth="1" strokeDasharray="3" className={styles.pulseNode} />
          <circle cx="320" cy="90" r="21" stroke="var(--accent-3)" strokeWidth="0.5" strokeDasharray="4" className={styles.pulseNode2} />
        </svg>
      );
    case "product":
    default:
      return (
        <svg viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="20" width="360" height="140" rx="6" fill="#1A1A18" fillOpacity="0.02" stroke="var(--border)" strokeWidth="1" />
          <rect x="40" y="70" width="75" height="40" rx="4" fill="var(--bg-subtle)" stroke="var(--border)" strokeWidth="1.5" />
          <rect x="162.5" y="70" width="75" height="40" rx="4" fill="var(--bg-subtle)" stroke="var(--border)" strokeWidth="1.5" />
          <rect x="285" y="70" width="75" height="40" rx="4" fill="var(--accent-light)" stroke="var(--accent)" strokeWidth="1.5" />
          <text x="77.5" y="94" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--ink)" textAnchor="middle" fontWeight="bold">DISCOVER</text>
          <text x="200" y="94" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--ink)" textAnchor="middle" fontWeight="bold">VALIDATE</text>
          <text x="322.5" y="94" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--accent)" textAnchor="middle" fontWeight="bold">DELIVER</text>
          <path d="M115 90 L162.5 90" stroke="var(--ink-muted)" strokeWidth="1" markerEnd="url(#arrow)" />
          <path d="M237.5 90 L285 90" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#arrowAccent)" />
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--ink-muted)" />
            </marker>
            <marker id="arrowAccent" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--accent)" />
            </marker>
          </defs>
        </svg>
      );
  }
};
