// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import {resolveOptionChips} from 'utils/property_options';

export type VisibleAttribute = {
    field: PropertyField;
    value: PropertyValue<unknown>;
};

/**
 * One entry of the chip row, with the number of values it is allowed to render.
 * `maxItems` is undefined for single-valued fields, which render exactly one.
 */
export type ChipAllocation = VisibleAttribute & {
    maxItems?: number;
};

const UNRENDERABLE_TYPES = new Set(['date', 'multiuser']);

// Field types that render one chip per stored entry rather than one per field.
// Only `multiselect` qualifies for the time being; the set is what decides which
// allocations carry a `maxItems` cap.
const MULTI_VALUED_TYPES = new Set(['multiselect']);

/**
 * Whether a stored value counts as set, judged on the value alone.
 *
 * Necessary but not sufficient for a chip: an option-bearing field also needs the
 * value to resolve to an option that still exists. `chipCount` is the whole answer.
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
    return field.attrs?.visibility !== 'hidden' && chipCount(field, value) > 0;
}

/**
 * How many chips a field earns on a post, before the row's budget is applied.
 *
 * The single answer to "is there anything to show?" — `isChipVisible` and
 * `allocateChipBudget` both go through it, so the filter, the budget and the
 * renderer cannot disagree about how many slots a field spends. A type the
 * dispatcher cannot render earns nothing.
 *
 * For an option-bearing field the count is the number of *resolvable* options, not
 * the number of stored entries. A value naming an option that no longer exists has
 * nothing to render — the chip's text and its colour both come from the option
 * definition — so it counts as unset. Counting it would spend a slot on an empty
 * chip and inflate `+N` with an attribute the user can never see.
 */
export function chipCount(field: PropertyField, value?: PropertyValue<unknown>): number {
    if (!value || !hasValue(value) || UNRENDERABLE_TYPES.has(field.type)) {
        return 0;
    }

    if (supportsOptions(field)) {
        return resolveOptionChips(field, value.value).length;
    }

    return 1;
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

/**
 * Spends a budget of `max` *rendered chips* across the visible attributes in order.
 *
 * The cap is on chips rather than on fields because a multi-valued field renders one
 * chip per entry: slicing the field list would let a single field with twelve
 * entries render twelve chips inside the first slot. `overflow` is therefore a count
 * of remaining *values*, which is what the `+N` badge shows.
 *
 * Attributes keep their order, so an attribute that no longer fits is not skipped in
 * favour of a later one that would — the row has to read in the same order on every
 * post in the channel.
 */
export function allocateChipBudget(visible: VisibleAttribute[], max: number): {
    shown: ChipAllocation[];
    overflow: number;
} {
    const shown: ChipAllocation[] = [];
    let remaining = Math.max(0, max);
    let overflow = 0;

    for (const attribute of visible) {
        const count = chipCount(attribute.field, attribute.value);
        const take = Math.min(count, remaining);

        if (take > 0) {
            shown.push({
                ...attribute,
                maxItems: MULTI_VALUED_TYPES.has(attribute.field.type) ? take : undefined,
            });
            remaining -= take;
        }

        overflow += count - take;
    }

    return {shown, overflow};
}
