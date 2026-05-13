import type { ReactNode } from 'react';
import styles from './PageHero.module.css';

interface PageHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  pulse?: boolean;
  compact?: boolean;
}

export default function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
  pulse = true,
  compact = false,
}: PageHeroProps) {
  return (
    <section className={`${styles.hero} ${compact ? styles.compact : ''}`}>
      <div className={styles.row}>
        <div className={styles.left}>
          {eyebrow && (
            <span className={styles.eyebrow}>
              {pulse && <span className={styles.pulse} />}
              {eyebrow}
            </span>
          )}
          <h1 className={`${styles.title} ${compact ? styles.titleCompact : ''}`}>
            {title}
          </h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.right}>{actions}</div>}
      </div>
    </section>
  );
}

export function HeroAccent({ children }: { children: ReactNode }) {
  return <span className={styles.accent}>{children}</span>;
}
