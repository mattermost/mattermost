import type {Variant} from '../types';
import {entadv} from './entadv';

/**
 * Ordered list of variants surfaced by the audience toggle. The first
 * entry is used as the default when no `variant` prop is passed.
 * Additional audience variants will be added here over time; the
 * toggle UI shows automatically once there is more than one entry.
 */
export const variants: Variant[] = [
  {id: 'entadv', label: 'Enterprise Advanced', content: entadv},
];

export function getVariant(id?: string): Variant {
  if (!id) return variants[0];
  return variants.find((v) => v.id === id) ?? variants[0];
}

export {entadv};
