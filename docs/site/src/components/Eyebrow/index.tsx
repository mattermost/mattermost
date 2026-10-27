import React from 'react';
import styles from './styles.module.css';

/**
 * Small section-name marker that sits above the H1 on inner-page
 * landings. Replaces the Hero block on /api, /api/examples, and
 * /developers — content-first, no marketing flair, brand presence
 * via the marigold uppercase eyebrow only.
 *
 * Usage:
 *   <Eyebrow>API Reference</Eyebrow>
 *   # REST API v4
 *   Subtitle paragraph...
 */
export default function Eyebrow({children}: {children: React.ReactNode}) {
  return <div className={styles.eyebrow}>{children}</div>;
}
