import React from 'react';
import type {IconName} from './types';

/**
 * Central icon registry. Content modules reference icons by key (see
 * `IconName` in `types.ts`) rather than importing JSX, so YAML/JSON
 * exports and PNG rendering pipelines stay independent of React.
 *
 * Prefer `iconSrc` (PNG under `/img/ime/logos/`) for product marks;
 * SVG keys here are for generic glyphs that have no deck asset.
 */

const stroke = {fill: 'none', stroke: 'currentColor', strokeWidth: 2} as const;

const iconMap: Record<IconName, React.ReactNode> = {
  star: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
};

export function getIcon(name?: IconName): React.ReactNode | null {
  if (!name) return null;
  return iconMap[name] ?? null;
}
