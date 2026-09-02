// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

export type VisibleAttribute = {
    field: PropertyField;
    value: PropertyValue<unknown>;
};

/**
 * Whether a stored value counts as set.
 *
 * The client's only mutation route is `patchPropertyValues`, which has no
 * empty-means-delete branch, so clearing an attribute stores an empty value rather
 * than removing the row: an empty value is a real row that has to be read as unset.
 * `0` and `false` are set.
 */
export function hasValue(value?: PropertyValue<unknown>): boolean {
    if (!value) {
        return false;
    }

    const raw = value.value;

    if (raw === null || raw === undefined || raw === '') {
        return false;
    }

    return !(Array.isArray(raw) && raw.length === 0);
}

/**
 * Whether a field earns a chip on the post.
 *
 * `attrs.visibility` is server-validated as `always` | `when_set` | `hidden`, and
 * absent means `when_set`. `always` behaves as `when_set` here: with no edit
 * affordance in scope, a chip whose only content is a placeholder is noise the user
 * can do nothing about.
 */
export function isChipVisible(field: PropertyField, value?: PropertyValue<unknown>): boolean {
    return field.attrs?.visibility !== 'hidden' && hasValue(value);
}

/**
 * Zips a channel's fields with a post's values and drops everything that earns no
 * chip, in the order the fields already come in (`sort_order`, then name).
 *
 * Driven by the field list, so a value whose field is unknown — which is what a field
 * deleted while this client was disconnected leaves behind — contributes nothing
 * rather than throwing.
 */
export function useVisibleAttributes(
    fields: PropertyField[],
    values: Array<PropertyValue<unknown>>,
): VisibleAttribute[] {
    return useMemo(() => {
        if (fields.length === 0 || values.length === 0) {
            return [];
        }

        const valuesByFieldId = new Map(values.map((value) => [value.field_id, value]));

        return fields.reduce<VisibleAttribute[]>((acc, field) => {
            const value = valuesByFieldId.get(field.id);

            if (value && isChipVisible(field, value)) {
                acc.push({field, value});
            }

            return acc;
        }, []);
    }, [fields, values]);
}
