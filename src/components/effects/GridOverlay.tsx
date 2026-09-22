"use client";

import styles from "./GridOverlay.module.css";

export default function GridOverlay() {
  return (
    <div className={styles.container}>
      <div className={styles.grid} />
      <div className={styles.meshGradient} />
    </div>
  );
}
