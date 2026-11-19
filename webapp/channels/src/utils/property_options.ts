// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {getPropertyFieldOptions} from 'mattermost-redux/utils/property_utils';

import {toValueList} from 'components/properties_card_view/propertyValueRenderer/multi_value_utils';

/**
 * One chip's worth of resolved content: what it says, what colour it takes, and a
 * value stable enough to key a list on.
 */
export type OptionChip = {
    key: string;
    label: string;
    color?: string;
};

/**
 * Whether a field carries its own list of options.
 *
 * Not the same question as `supportsOptions`, which asks about the field's *type*.
 * Content flagging's `reporting_reason` is a `select` that defines no options at
 * all — its choices live in server config
 * (`ContentFlaggingSettings.AdditionalSettings.Reasons`) and the chosen string is
 * stored directly on the value. An empty list counts as no list: the two are not
 * meaningfully distinguishable on the wire.
 */
export function hasOptions(field: PropertyField): boolean {
    return getPropertyFieldOptions(field).length > 0;
}

/**
 * The option a stored value refers to.
 */
export function resolveOption(field: PropertyField, value: unknown): PropertyFieldOption | undefined {
    const options = getPropertyFieldOptions(field);

    if (options.length === 0) {
        return undefined;
    }

    return options.find((option) => option.id === value) ?? options.find((option) => option.name === value);
}

/**
 * The chips a stored value earns, in stored order.
 *
 * For a field whose choices may live outside it, such as content flagging's
 * `reporting_reason`; post attributes keep theirs on the field and use
 * `resolveFieldOptionChips`.
 *
 * Two cases, and the difference matters:
 *
 * - **The field defines options.** The chip *is* the option — its label and its
 *   colour both come from the option definition — so an entry naming an option that
 *   no longer exists has nothing to render and is dropped. Showing the raw stored
 *   text instead would put an identifier the user never chose into a colourless
 *   chip, and claim the post carries an attribute the field no longer defines.
 *
 * - **The field defines none.** Nothing has been deleted; the choices simply live
 *   somewhere this field cannot see, so the stored string *is* the content and it
 *   renders uncoloured. This is content flagging's `reporting_reason`, and dropping
 *   it would blank a chip that ships today.
 *
 * Finally the list is capped by the field's arity: only a `multiselect` renders more
 * than one chip. That belongs here rather than in the renderer because arity is a
 * property of the field type, and because the count this returns is the count the
 * post row budgets — see `chipCount`.
 */
export function resolveOptionChips(field: PropertyField, value: unknown): OptionChip[] {
    const entries = toValueList(value);

    return capByArity(field, hasOptions(field) ? resolveEach(field, entries) : rawChips(entries));
}

/**
 * The chips a stored value earns on a field that always keeps its options on the
 * field, such as every post attribute.
 *
 * Unlike `resolveOptionChips`, an empty or missing list is not read as "the choices
 * live elsewhere": such a field has none elsewhere, so it means every option was
 * deleted, and the stored ids name nothing. The server cannot tell the two apart
 * either, since it rebuilds the list from stored options on every read and leaves
 * it out when there are none, so it's the caller that knows which kind of field it
 * has.
 */
export function resolveFieldOptionChips(field: PropertyField, value: unknown): OptionChip[] {
    return capByArity(field, resolveEach(field, toValueList(value)));
}

// Only a `multiselect` renders more than one chip.
function capByArity(field: PropertyField, chips: OptionChip[]): OptionChip[] {
    return field.type === 'multiselect' ? chips : chips.slice(0, 1);
}

function resolveEach(field: PropertyField, entries: unknown[]): OptionChip[] {
    return entries.reduce<OptionChip[]>((chips, entry) => {
        const option = resolveOption(field, entry);

        if (option) {
            chips.push({key: option.id, label: option.name, color: option.color});
        }

        return chips;
    }, []);
}

function rawChips(entries: unknown[]): OptionChip[] {
    return entries.map((entry) => ({key: String(entry), label: String(entry)}));
}
