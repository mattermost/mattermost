import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

// Verbs with a dedicated color. Anything else falls back to the neutral
// --mm-method-other fill, same as the sidebar chips in custom.css.
const TONES = ['get', 'post', 'put', 'patch', 'delete'] as const;

export type Props = {
  method: string;

  /** 'sm' matches the sidebar chips; 'md' is the roomier landing-page size. */
  size?: 'sm' | 'md';

  className?: string;
};

/**
 * The HTTP verb chip, in React form.
 *
 * The sidebar's chips can't use this — a sidebar item only carries its
 * method as a CSS class, so those are drawn with ::before content in
 * custom.css. Both read the same --mm-method-* tokens, so the two stay in
 * visual lockstep; if you change one, check the other.
 */
export default function MethodBadge({method, size = 'sm', className}: Props) {
  const tone = method.toLowerCase();

  return (
    <span
      className={clsx(
        styles.badge,
        styles[size],
        (TONES as readonly string[]).includes(tone) && styles[tone],
        className,
      )}
    >
      {method.toUpperCase()}
    </span>
  );
}
