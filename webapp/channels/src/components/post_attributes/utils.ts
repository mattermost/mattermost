// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import {toValueList} from 'components/properties_card_view/propertyValueRenderer/multi_value_utils';

import {resolveOptionChips} from 'utils/property_options';

/**
 * A field paired with whatever the post stores for it.
 *
 * The value is optional, and that is the whole difference between the two
 * surfaces this feeds: the chip row only ever holds attributes that have one
 * (`isChipVisible` drops the rest), while an editable surface keeps an unset
 * `always` field so there is something to act on (`isFieldValueVisible`). The
 * filter decides; the shape is the same either way.
 */
export type PostAttribute = {
    field: PropertyField;
    value?: PropertyValue<unknown>;
};

/**
 * One entry of the chip row, with the number of values it is allowed to render.
 * `maxItems` is undefined for single-valued fields, which render exactly one.
 */
export type ChipAllocation = PostAttribute & {
    maxItems?: number;
};

const UNRENDERABLE_TYPES = new Set(['date']);

// Field types that render one chip per stored entry rather than one per field.
// `multiselect` and `multiuser` both qualify; the set is what decides which
// allocations carry a `maxItems` cap. Without the cap a field granted one
// remaining slot would render every entry it holds inside that one slot.
const MULTI_VALUED_TYPES = new Set(['multiselect', 'multiuser']);

const EDITABLE_TYPES = new Set(['select', 'rank', 'multiselect', 'text', 'user', 'multiuser']);

// Whether a field has a control that can write it.
export function hasValueControl(field: PropertyField): boolean {
    return EDITABLE_TYPES.has(field.type);
}

/**
 * The added set a caller that has none passes.
 *
 * Module-level and frozen on purpose. A `new Set()` default would be a fresh
 * reference on every render, which defeats `useModalAttributes`'s `useMemo` for
 * every caller that does not track added rows.
 */
const EMPTY_ADDED: ReadonlySet<string> = Object.freeze(new Set<string>());

/**
 * The label a field carries on screen: the administrator-set display name,
 * falling back to the field's name.
 */
export function fieldLabel(field: PropertyField): string {
    const displayName = field.attrs?.display_name;
    return typeof displayName === 'string' && displayName ? displayName : field.name;
}

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
 * A value's stored entries, as strings, with the empty ones dropped.
 *
 * Shared because two callers have to agree on what counts as an entry: the
 * option menu decides which items carry a check mark from this, and
 * `PostAttributeText` decides which names to render from it. If they disagreed,
 * the menu would tick an option the card does not show.
 */
export function storedEntries(value?: PropertyValue<unknown>): string[] {
    return toValueList(value?.value).
        filter((entry) => entry !== null && entry !== undefined && entry !== '').
        map(String);
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

    /*
     * `multiuser` counts *stored* entries, where the option branch above counts
     * *resolvable* ones. The difference is not an oversight. An option is
     * resolved synchronously against the field definition, so a value naming a
     * deleted option is known to be unrenderable at count time and is dropped,
     * rather than spending a slot on a chip that draws nothing. A user id has
     * no synchronous equivalent: `useUser`
     * resolves asynchronously, so "this user was deleted" and "this profile has
     * not arrived yet" are the same state when the count is taken. Counting
     * resolvable users would make the chip count — and the row's width — change
     * as profiles land. So every stored id keeps its slot, and one that never
     * resolves renders `UserProfileComponent`'s `Someone` fallback.
     */
    if (field.type === 'multiuser') {
        return toValueList(value.value).length;
    }

    return 1;
}

/**
 * Whether a field's value should be shown on a surface that can edit it.
 *
 * A field declared `always` is shown even with nothing stored, because an empty
 * slot on an editable surface is something the user can act on. Everything else
 * is shown once there is something to show.
 *
 * **`hidden` is not consulted here**, which is the one place this parts company
 * with `isChipVisible`. `visibility` says where an attribute is *advertised*,
 * not who may see it: the server sends hidden fields and their values to every
 * client that can read the post and redacts nothing. So `hidden` keeps an
 * attribute off the message list and out of the hover card, and the edit modal
 * shows it anyway.
 *
 * Note this reaches `chipCount` directly rather than going through
 * `isChipVisible`, which carries a `hidden` guard of its own.
 */
export function isFieldValueVisible(field: PropertyField, value?: PropertyValue<unknown>): boolean {
    return field.attrs?.visibility === 'always' || chipCount(field, value) > 0;
}

/**
 * Zips a channel's fields with a post's values, in the order the fields already
 * come in (`sort_order`, then name), keeping the entries `include` accepts.
 *
 * Driven by the field list, so a value whose field is unknown — which is what a field
 * deleted while this client was disconnected leaves behind — contributes nothing
 * rather than throwing.
 */
function zipAttributes(
    fields: PropertyField[],
    values: Array<PropertyValue<unknown>>,
    include: (field: PropertyField, value?: PropertyValue<unknown>) => boolean,
): PostAttribute[] {
    if (fields.length === 0) {
        return [];
    }

    const valuesByFieldId = new Map(values.map((value) => [value.field_id, value]));

    return fields.reduce<PostAttribute[]>((acc, field) => {
        const value = valuesByFieldId.get(field.id);

        if (include(field, value)) {
            acc.push({field, value});
        }

        return acc;
    }, []);
}

/**
 * The attributes that earn a chip on the post, in field order.
 */
export function useVisibleAttributes(
    fields: PropertyField[],
    values: Array<PropertyValue<unknown>>,
): PostAttribute[] {
    return useMemo(() => {
        if (values.length === 0) {
            return [];
        }

        return zipAttributes(fields, values, isChipVisible);
    }, [fields, values]);
}

/**
 * The attributes that earn a row in the edit modal, in field order.
 *
 * Differs from `useVisibleAttributes` in two ways — an unset `always` field is
 * kept, and so is any field the user asked for during this opening — which is
 * why both go through the same traversal.
 *
 * `added` holds field ids and nothing else. It decides which rows exist, never
 * what they display: every row still reads its value from the store.
 *
 * Nothing here consults `visibility` beyond what `isFieldValueVisible` does,
 * `hidden` included — see its comment. This predicate did briefly carry a
 * `hidden` guard of its own, from the days when `hidden` meant hidden in the
 * modal too.
 */
export function useModalAttributes(
    fields: PropertyField[],
    values: Array<PropertyValue<unknown>>,
    added: ReadonlySet<string> = EMPTY_ADDED,
): PostAttribute[] {
    return useMemo(
        () => zipAttributes(
            fields,
            values,
            (field, value) => isFieldValueVisible(field, value) || added.has(field.id),
        ),
        [fields, values, added],
    );
}

/**
 * The fields a picker may offer: everything the channel declares that is not
 * already being shown and this user could actually fill in.
 */
export function useAddableAttributes(
    fields: PropertyField[],
    values: Array<PropertyValue<unknown>>,
    added: ReadonlySet<string>,
    canEdit: (field: PropertyField) => boolean,
): PropertyField[] {
    return useMemo(() => {
        const valuesByFieldId = new Map(values.map((value) => [value.field_id, value]));

        return fields.filter((field) =>
            !isFieldValueVisible(field, valuesByFieldId.get(field.id)) &&
            !added.has(field.id) &&
            canEdit(field) &&
            hasValueControl(field));
    }, [fields, values, added, canEdit]);
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
export function allocateChipBudget(visible: PostAttribute[], max: number): {
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
