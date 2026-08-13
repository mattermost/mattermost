// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

// Returns true if the field uses the legacy PSAv1 schema.
// Legacy properties have an empty object_type and rely on simple target_id
// uniqueness, rather than the hierarchical uniqueness model used by PSAv2.
export function isPSAv1PropertyField(field: PropertyField): boolean {
    return !field.object_type;
}

// Whether a value must be supplied when the target resource is created. The
// server validates the key as a boolean, so anything else here means the field
// predates that validation; treat it as not required rather than guessing.
export function isPropertyFieldRequired(field: PropertyField): boolean {
    return field.attrs?.required === true;
}

// Whether a value may change after it is first set. Absent means editable: the
// permissive default has to stay indistinguishable from an explicit true, or
// every field created before the key existed would read as locked.
export function isPropertyFieldEditable(field: PropertyField): boolean {
    return field.attrs?.editable !== false;
}

// The label to show for a field. display_name is the admin-facing override;
// name is the CEL-safe slug and the fallback.
export function getPropertyFieldLabel(field: PropertyField): string {
    const displayName = field.attrs?.display_name;
    return typeof displayName === 'string' && displayName ? displayName : field.name;
}
