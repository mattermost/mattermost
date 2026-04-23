// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties';

/**
 * Returns the user-facing label for a CPA field.
 * Prefers attrs.display_name (trimmed); falls back to name for legacy
 * fields that have not been backfilled yet.
 *
 * Use for ALL human-readable label rendering (visible text, aria-label,
 * title, section headings, delete-modal titles, etc.).
 *
 * Do NOT use for:
 *   - CEL expression construction  → use field.name
 *   - React keys                   → use field.id or field.name
 *   - HTML element ids             → use field.name or field.id
 *   - Comparison with currentAttribute in ABAC selectors → use field.name
 */
export function getUserPropertyFieldLabel(
    field: Pick<UserPropertyField, 'name' | 'attrs'>,
): string {
    const displayName = field.attrs?.display_name?.trim();
    return displayName || field.name;
}
