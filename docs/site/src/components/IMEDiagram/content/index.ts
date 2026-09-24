import type {Variant} from '../types';
import {general} from './general';
import {mission} from './mission';

/**
 * Ordered list of variants surfaced by the audience toggle. The first
 * entry is used as the default when no `variant` prop is passed.
 *
 * The `general` content module is kept in the tree (imported below) so
 * it can be re-added to this array — or referenced directly by tests
 * and the PNG renderer — without a resurrection commit. Additional
 * audience variants will be added here over time; the toggle UI shows
 * automatically once there is more than one entry.
 */
export const variants: Variant[] = [
  {id: 'mission', label: 'Enterprise Advanced', content: mission},
];

export function getVariant(id?: string): Variant {
  if (!id) return variants[0];
  return variants.find((v) => v.id === id) ?? variants[0];
}

export {general, mission};
