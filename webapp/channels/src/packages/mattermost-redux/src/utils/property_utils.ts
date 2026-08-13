// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

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

// Absent means editable, so fields created before the key existed do not read as
// locked.
export function isPropertyFieldEditable(field: PropertyField): boolean {
    return field.attrs?.editable !== false;
}

// display_name is the admin-facing override; name is the CEL-safe slug fallback.
export function getPropertyFieldLabel(field: PropertyField): string {
    const displayName = field.attrs?.display_name;
    return typeof displayName === 'string' && displayName ? displayName : field.name;
}
