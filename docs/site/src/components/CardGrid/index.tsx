import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

type Card = {
  title: string;
  description?: string;
  to: string;
  icon?: string;       // CompassIcon name
  meta?: string;       // small annotation (e.g., "549 endpoints")
};

/**
 * Grid of navigation cards for landing pages. Replaces bulleted lists
 * of links — each card is a discrete navigation surface with title,
 * description, and optional Compass icon + meta.
 *
 * The `compact` variant renders the same cards as a wrapping row of
 * low-weight chips, for secondary destinations that need to stay
 * scannable without competing with a primary card grid above them.
 *
 * Usage:
 *   <CardGrid cards={[
 *     {title: 'Examples', icon: 'channels', to: '/api/examples',
 *      description: 'Quick-start with curl.', meta: '6 examples'},
 *     {title: 'Reference', icon: 'boards', to: '/api/reference/login',
 *      description: 'Every endpoint, grouped by resource.', meta: '549 endpoints'},
 *   ]} />
 *
 *   <CardGrid variant="compact" cards={[
 *     {title: 'Compliance Officers', to: '/for/compliance-officer',
 *      description: 'Audit evidence, exports.'},
 *   ]} />
 */
export default function CardGrid({
  cards,
  columns = 3,
  variant = 'default',
}: {
  cards: Card[];
  columns?: 2 | 3 | 4;
  variant?: 'default' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <div className={styles.chipRow}>
        {cards.map((c, i) => (
          <Link key={`${c.to}-${i}`} to={c.to} className={styles.chip}>
            <span className={styles.chipBody}>
              <span className={styles.chipTitle}>{c.title}</span>
              {c.description && <span className={styles.chipDescription}>{c.description}</span>}
            </span>
            <span className={styles.chipArrow} aria-hidden>→</span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className={`${styles.grid} ${styles[`cols${columns}`]}`}>
      {cards.map((c, i) => (
        <Link key={`${c.to}-${i}`} to={c.to} className={styles.card}>
          {c.icon && <span className={`${styles.icon} mm-compass-${c.icon}`} aria-hidden />}
          <div className={styles.body}>
            <div className={styles.title}>{c.title}</div>
            <p className={styles.description}>{c.description}</p>
            {c.meta && <span className={styles.meta}>{c.meta}</span>}
          </div>
          <span className={styles.arrow} aria-hidden>→</span>
        </Link>
      ))}
    </div>
  );
}
