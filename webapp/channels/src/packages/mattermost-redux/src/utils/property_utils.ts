// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyChangePolicy, PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

// Returns true if the field uses the legacy PSAv1 schema.
// Legacy properties have an empty object_type and rely on simple target_id
// uniqueness, rather than the hierarchical uniqueness model used by PSAv2.
export function isPSAv1PropertyField(field: PropertyField): boolean {
    return !field.object_type;
}

// Anything non-boolean predates the server-side validation of this key; treat it
// as not required rather than guessing.
export function isPropertyFieldRequired(field: PropertyField): boolean {
    return field.attrs?.required === true;
}

// Mirrors model.GetPropertyFieldChangePolicy: change_policy wins, an explicit
// editable=false reads as "never" so fields written before the key keep their
// behaviour, and anything unrecognised falls back to the permissive default.
export function getPropertyFieldChangePolicy(field: PropertyField): PropertyChangePolicy {
    const policy = field.attrs?.change_policy;
    if (policy === 'never' || policy === 'raise_only' || policy === 'lower_only' || policy === 'any') {
        return policy;
    }
    if (field.attrs?.editable === false) {
        return 'never';
    }
    return 'any';
}

// Absent means editable, so fields created before the key existed do not read as
// locked.
export function isPropertyFieldEditable(field: PropertyField): boolean {
    return getPropertyFieldChangePolicy(field) !== 'never';
}

// Whether a stored value counts as set. Mirrors isEmptyPropertyValue on the
// server: null, an empty string and an empty list all read as "Not set".
export function isPropertyValueSet(raw: unknown): boolean {
    if (raw === null || raw === undefined || raw === '') {
        return false;
    }
    return !(Array.isArray(raw) && raw.length === 0);
}

// A field's option list, or an empty one. attrs is loosely typed, so every
// caller would otherwise repeat the same cast; an absent list and an empty list
// are not distinguishable on the wire, so both read as empty here.
export function getPropertyFieldOptions(field: PropertyField): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

// The server normalises rank fields to a contiguous 1..N, so the positional
// fallback only covers option lists cached before that ran.
export function getOptionRank(field: PropertyField, optionId: string): number | undefined {
    const options = getPropertyFieldOptions(field);
    const index = options.findIndex((option) => option.id === optionId);
    if (index < 0) {
        return undefined;
    }
    const {rank} = options[index];
    return typeof rank === 'number' ? rank : index + 1;
}

/**
 * Whether the field's change policy permits moving from its current value to the
 * given option. Higher rank is higher, matching the server.
 *
 * An unset value may move anywhere: the policy governs changes, not the first
 * write. A rank that cannot be resolved on either side fails closed, since an
 * unresolvable comparison on a marking must not read as permitted.
 */
export function canMoveToOption(field: PropertyField, currentValue: unknown, optionId: string): boolean {
    if (!isPropertyValueSet(currentValue)) {
        return true;
    }

    const policy = getPropertyFieldChangePolicy(field);
    if (policy === 'any') {
        return true;
    }
    if (policy === 'never') {
        return false;
    }

    const currentId = typeof currentValue === 'string' ? currentValue : undefined;
    if (!currentId) {
        return false;
    }

    const currentRank = getOptionRank(field, currentId);
    const nextRank = getOptionRank(field, optionId);
    if (currentRank === undefined || nextRank === undefined) {
        return false;
    }

    return policy === 'raise_only' ? nextRank > currentRank : nextRank < currentRank;
}

// Classification Markings stores its unique name as this lowercase slug and
// does not write display_name. User-facing surfaces should match the admin
// heading ("Classification"), not the slug.
const CLASSIFICATION_FIELD_NAME = 'classification';

// Title-cases an internal name so it reads as a heading. Also used directly by
// the Manage Attributes page, which renders a field's slug as a page heading.
export function formatPropertyFieldLabel(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        return trimmed;
    }
    return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

// display_name is the admin-facing override; name is the CEL-safe slug fallback.
export function getPropertyFieldLabel(field: PropertyField): string {
    const displayName = field.attrs?.display_name;
    const raw = typeof displayName === 'string' && displayName ? displayName : field.name;
    if (field.name === CLASSIFICATION_FIELD_NAME) {
        return formatPropertyFieldLabel(raw);
    }
    return raw;
}
