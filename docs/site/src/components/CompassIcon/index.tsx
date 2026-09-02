import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

/**
 * Brand-aligned icon. Ports the Hugo `compass-icon` shortcode used in
 * mattermost-developer-documentation. Backed by SVGs in
 * docs-site/static/img/icons/. During phase 4 the full Compass icon
 * library is bulk-imported (see PLAN.md §11.2 Week 1).
 *
 * Usage:
 *   <CompassIcon name="channels" size="md" tone="denim" />
 */
export default function CompassIcon({
  name,
  size = 'sm',
  tone = 'denim',
  alt = '',
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tone?: 'denim' | 'marigold' | 'inherit';
  alt?: string;
}) {
  const src = useBaseUrl(`/img/icons/${name}.svg`);
  return (
    <span
      className={`${styles.icon} ${styles[size]} ${styles[tone]}`}
      role={alt ? 'img' : 'presentation'}
      aria-label={alt || undefined}
      style={{maskImage: `url(${src})`, WebkitMaskImage: `url(${src})`}}
    />
  );
}
