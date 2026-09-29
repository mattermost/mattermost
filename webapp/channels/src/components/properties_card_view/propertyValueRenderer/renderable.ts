// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

/**
 * The `text` subtypes whose stored string is not the text to show, and which
 * therefore have a renderer of their own: three store an id to resolve,
 * `timestamp` stores an epoch to format.
 *
 * Not a wire contract — `attrs.subType` is typed `string`, and the server
 * neither validates nor enumerates it. This list includes the subTypes the
 * features add and use.
 *
 * So a subtype reaching a client that predates it is a real possibility, not a
 * hypothetical, and `text` is absent here on purpose: it is the plain case and
 * the fallback every unrecognised subtype takes.
 */
export const SPECIALISED_TEXT_SUBTYPES = ['post', 'channel', 'team', 'timestamp'] as const;

export type SpecialisedTextSubtype = typeof SPECIALISED_TEXT_SUBTYPES[number];

// A text field's subtype. Absent, empty or non-string all read as plain: most
// text fields set no subType at all.
export function textSubtype(field: PropertyField): string {
    const subType = field.attrs?.subType;
    return typeof subType === 'string' && subType ? subType : 'text';
}

export function hasSpecialisedTextRenderer(subType: string): subType is SpecialisedTextSubtype {
    return (SPECIALISED_TEXT_SUBTYPES as readonly string[]).includes(subType);
}

/**
 * Whether anything would actually appear for this field.
 *
 * The single answer, shared by the renderers and by any caller that budgets
 * space *before* rendering — the post chip row spends a fixed number of slots,
 * so a field that draws nothing must not be given one. Keeping a second list
 * is what let `graph` through: it was added to `FieldType` after the chip row's
 * own exclusion set was written, so the row paid a slot for an empty chip and
 * pushed a real attribute into `+N`.
 *
 * `propertyValueRenderer.test.tsx` asserts this agrees with what
 * `PropertyValueRenderer` draws for every `FieldType`, so the two cannot drift
 * again without a test failing.
 */
export function canRenderPropertyValue(field: PropertyField): boolean {
    switch (field.type) {
    // Every subtype renders: the specialised ones through their own renderer,
    // and anything else — including a subtype this client has never heard of —
    // as the stored string.
    case 'text':
    case 'user':
    case 'multiuser':
    case 'select':
    case 'rank':
    case 'multiselect':
        return true;

    default:
        return false;
    }
}
