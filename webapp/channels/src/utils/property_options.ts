// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption, SelectPropertyField} from '@mattermost/types/properties';

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

const fieldOptions = (field: PropertyField): PropertyFieldOption[] | undefined => (field as SelectPropertyField).attrs?.options;

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
    return Boolean(fieldOptions(field)?.length);
}

/**
 * The option a stored value refers to.
 */
export function resolveOption(field: PropertyField, value: unknown): PropertyFieldOption | undefined {
    const options = fieldOptions(field);

    if (!options?.length) {
        return undefined;
    }

    return options.find((option) => option.id === value) ?? options.find((option) => option.name === value);
}

/**
 * The chips a stored value earns, in stored order.
 *
 * The single answer to "what does this value put on screen?", shared by both chip
 * renderers and by the post row's budget so they cannot disagree about how many
 * chips a field is worth.
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

    const chips = hasOptions(field) ? resolveEach(field, entries) : rawChips(entries);

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
    return entries.
        filter((entry) => entry !== null && entry !== undefined && entry !== '').
        map((entry) => ({key: String(entry), label: String(entry)}));
}
