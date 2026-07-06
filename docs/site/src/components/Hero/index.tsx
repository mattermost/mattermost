import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

type Cta = {
  label: string;
  to: string;
  variant?: 'primary' | 'ghost';
};

type Props = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  ctas?: Cta[];
  /** Pillars under the hero — defaults to brand pillars on the home hero. */
  pillars?: {label: string; description?: string}[];
  /** Restraint level: 'full' for /, 'compact' for /developers /api. */
  intensity?: 'full' | 'compact';
};

export default function Hero({
  eyebrow,
  title,
  subtitle,
  ctas = [],
  pillars,
  intensity = 'compact',
}: Props): React.ReactElement {
  const camoUrl = useBaseUrl('/img/patterns/hex-camo-denim.svg');
  return (
    <section
      className={`mm-hero ${styles.hero} ${intensity === 'full' ? styles.full : styles.compact}`}
      style={{['--mm-hero-camo' as string]: `url(${camoUrl})`}}
    >
      <div className={styles.inner}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        {title && <h1 className={styles.title}>{title}</h1>}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {ctas.length > 0 && (
          <div className={styles.ctas}>
            {ctas.map((cta, i) => (
              <Link
                key={`${cta.label}-${i}`}
                to={cta.to}
                className={cta.variant === 'ghost' ? styles.ctaGhost : styles.ctaPrimary}
              >
                {cta.label}
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        )}
        {pillars && (
          <ul className={styles.pillars}>
            {pillars.map((p) => (
              <li key={p.label}>
                <strong>{p.label}</strong>
                {p.description && <span>{p.description}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.curve} aria-hidden />
    </section>
  );
}
