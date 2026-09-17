import type {Variant} from '../types';
import {general} from './general';
import {mission} from './mission';

/**
 * Ordered list of variants surfaced by the audience toggle. The first
 * entry is used as the default when no `variant` prop is passed.
 */
export const variants: Variant[] = [
  {id: 'general', label: 'General', content: general},
  {id: 'mission', label: 'National Security', content: mission},
];

export function getVariant(id?: string): Variant {
  if (!id) return variants[0];
  return variants.find((v) => v.id === id) ?? variants[0];
}

export {general, mission};
