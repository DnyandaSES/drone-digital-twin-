/* ────────────────────────────────────────────────────────
   AEROTWIN — CORNER BRACKETS
   Four L-shaped brackets placed in the corners of a
   panel to signal "this is being observed in real time."
   ──────────────────────────────────────────────────────── */

import styles from "./CornerBracket.module.css";


interface CornerBracketProps {
  /** Turn brackets red to signal an active alert. */
  alert?: boolean;
}

export default function CornerBracket({ alert = false }: CornerBracketProps) {
  const cls = alert ? `${styles.wrap} ${styles.alert}` : styles.wrap;

  return (
    <div className={cls} aria-hidden="true">
      <span className={`${styles.corner} ${styles.tl}`} />
      <span className={`${styles.corner} ${styles.tr}`} />
      <span className={`${styles.corner} ${styles.bl}`} />
      <span className={`${styles.corner} ${styles.br}`} />
    </div>
  );
}
