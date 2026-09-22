"use client";

import type { Dictionary } from "@/types/content";
import styles from "./UnderConstruction.module.css";

interface UnderConstructionProps {
  dict?: Dictionary;
  lang?: string;
  customMessage?: string;
}

export default function UnderConstruction({
  lang = "es",
  customMessage,
}: UnderConstructionProps) {
  // Render localized editorial message
  const renderMessage = () => {
    if (customMessage) {
      return customMessage;
    }

    if (lang === "en") {
      return (
        <>
          Still <em>thinking</em> about how to <em>express</em> this section.
        </>
      );
    }

    if (lang === "de") {
      return (
        <>
          Ich überlege noch, wie ich diesen Bereich <em>ausdrücken</em> soll.
        </>
      );
    }

    // Default: Spanish
    return (
      <>
        Todavía estoy <em>pensando</em> cómo <em>expresar</em> esta sección.
      </>
    );
  };

  return (
    <section className={styles.container} aria-label="Sección en preparación">
      <div className={styles.contentWrapper}>
        <h1 className={styles.headline}>
          {renderMessage()}
        </h1>
      </div>
    </section>
  );
}
