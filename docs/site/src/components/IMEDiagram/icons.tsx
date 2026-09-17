import React from 'react';
import type {IconName} from './types';

/**
 * Central icon registry. Content modules reference icons by key (see
 * `IconName` in `types.ts`) rather than importing JSX, so YAML/JSON
 * exports and PNG rendering pipelines stay independent of React.
 */

const stroke = {fill: 'none', stroke: 'currentColor', strokeWidth: 2} as const;

const iconMap: Record<IconName, React.ReactNode> = {
  chat: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  ),
  checklist: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  call: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  sparkles: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  server: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="2" y="3" width="20" height="6" rx="1"/>
      <rect x="2" y="15" width="20" height="6" rx="1"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  plug: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  devices: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="2" y="3" width="14" height="11" rx="1"/>
      <rect x="14" y="9" width="8" height="11" rx="1"/>
      <line x1="2" y1="17" x2="11" y2="17"/>
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="3"/>
      <circle cx="4" cy="4" r="2"/>
      <circle cx="20" cy="4" r="2"/>
      <circle cx="4" cy="20" r="2"/>
      <circle cx="20" cy="20" r="2"/>
      <line x1="6" y1="6" x2="10" y2="10"/>
      <line x1="18" y1="6" x2="14" y2="10"/>
      <line x1="6" y1="18" x2="10" y2="14"/>
      <line x1="18" y1="18" x2="14" y2="14"/>
    </svg>
  ),
};

export function getIcon(name?: IconName): React.ReactNode | null {
  if (!name) return null;
  return iconMap[name] ?? null;
}
