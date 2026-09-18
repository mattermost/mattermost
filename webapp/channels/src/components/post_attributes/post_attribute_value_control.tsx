// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption, PropertyValue, SelectPropertyField} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

import {resolveOption} from 'utils/property_options';

import PostAttributeText from './post_attribute_text';
import {fieldLabel, storedEntries} from './utils';

type Props = {
    field: PropertyField;
    value?: PropertyValue<unknown>;
    disabled: boolean;
    onChange: (fieldId: string, next: unknown) => void;
};

/**
 * The field types this module can write.
 *
 * `user` and `multiuser` are part 2 of S12 — plan 10.4's last two rows, plus
 * 10.5's `multiuser` renderer, which has to land in the same slice or the modal
 * offers a control for a value the chip row cannot draw. `date` is out until its
 * wire encoding is decided (spec D8).
 *
 * The row reads this rather than `canEdit` alone, so an unwritable *type* shows
 * its value as read-only text with no trash button instead of an empty cell.
 *
 * Kept in step with the switch below by hand: adding a type means editing both,
 * and the switch's `default` arm is unreachable while they agree, because the
 * row only mounts the control when `hasValueControl` is true.
 */
const EDITABLE_TYPES = new Set(['select', 'rank', 'multiselect', 'text']);

export function hasValueControl(field: PropertyField): boolean {
    return EDITABLE_TYPES.has(field.type);
}

/**
 * The control a modal row uses to write one attribute.
 *
 * Every shape calls the same `onChange(fieldId, next)`; none of them holds a copy
 * of the stored value for display (spec D15). The text control keeps a draft of
 * what is being typed, which is not the same thing — see `TextControl`.
 */
export default function PostAttributeValueControl({field, value, disabled, onChange}: Props) {
    switch (field.type) {
    case 'select':
    case 'rank':
    case 'multiselect':
        return (
            <OptionMenu
                field={field}
                value={value}
                disabled={disabled}
                onChange={onChange}
            />
        );

    case 'text':
        return (
            <TextControl
                key={storedText(value)}
                field={field}
                value={value}
                disabled={disabled}
                onChange={onChange}
            />
        );

    default:
        return null;
    }
}

function fieldOptions(field: PropertyField): PropertyFieldOption[] {
    return (field as SelectPropertyField).attrs?.options ?? [];
}

function storedText(value?: PropertyValue<unknown>): string {
    return typeof value?.value === 'string' ? value.value : '';
}

/**
 * A menu of the field's options with a check on each chosen one.
 */
function OptionMenu({field, value, disabled, onChange}: Props) {
    const label = fieldLabel(field);
    const isMulti = field.type === 'multiselect';
    const options = fieldOptions(field);
    const entries = storedEntries(value);

    // A stored entry names an option by id or, for older data, by name — the same
    // two forms `resolveOption` accepts. Both are matched here so the check mark
    // and the chip cannot disagree about what is selected.
    const isSelected = (option: PropertyFieldOption) => entries.includes(option.id) || entries.includes(option.name);

    const handlePick = (option: PropertyFieldOption) => {
        if (!isMulti) {
            onChange(field.id, option.id);
            return;
        }

        /*
         * Normalised to option ids before writing back, so a toggle cannot leave
         * the array half in ids and half in names. An entry naming an option that
         * no longer exists does not resolve and is kept verbatim rather than
         * silently dropped — this write is a toggle of one option, not a cleanup
         * of the rest.
         */
        const normalised = entries.map((entry) => resolveOption(field, entry)?.id ?? entry);

        const next = isSelected(option) ?
            normalised.filter((entry) => entry !== option.id) :
            [...normalised, option.id];

        onChange(field.id, next);
    };

    if (options.length === 0) {
        return value ? (
            <PostAttributeText
                field={field}
                value={value}
            />
        ) : null;
    }

    return (
        <Menu.Container
            menuButton={{
                id: `postAttributeValueTrigger-${field.id}`,
                dataTestId: `post-attribute-trigger-${field.name}`,
                class: 'PostAttributesModalRow__trigger',
                disabled,
                'aria-label': label,
                children: value ? (
                    <PostAttributeText
                        field={field}
                        value={value}
                    />
                ) : null,
            }}
            menu={{
                id: `postAttributeValueMenu-${field.id}`,
                'aria-label': label,
            }}
        >
            {options.map((option) => {
                const checked = isSelected(option);

                return (
                    <Menu.Item
                        key={option.id}
                        id={`postAttributeOption-${field.id}-${option.id}`}

                        // `menuitemradio`/`menuitemcheckbox` rather than
                        // `menuitem`: the check mark is state, not decoration. The
                        // roles also decide the close behaviour — a checkbox item
                        // leaves the menu open so several options can be picked,
                        // and `forceCloseOnSelect` puts the single-choice case back
                        // to closing on pick.
                        role={isMulti ? 'menuitemcheckbox' : 'menuitemradio'}
                        aria-checked={checked}
                        forceCloseOnSelect={!isMulti}
                        labels={<span>{option.name}</span>}
                        trailingElements={checked ? <CheckIcon size={16}/> : undefined}
                        onClick={() => handlePick(option)}
                    />
                );
            })}
        </Menu.Container>
    );
}

/**
 * An inline text input that commits on blur.
 *
 * The draft is keystrokes, not a staged value: it exists because an input has to
 * be typed into, and it is never what the row displays once the field is left.
 * Enter blurs rather than writing directly, so blur stays the single commit path
 * and Enter cannot fire a second PATCH on the way out.
 */
function TextControl({field, value, disabled, onChange}: Props) {
    const stored = storedText(value);
    const [draft, setDraft] = useState(stored);

    const handleBlur = useCallback(() => {
        if (draft !== stored) {
            onChange(field.id, draft);
        }
    }, [draft, stored, field.id, onChange]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
        }
    }, []);

    return (
        <Input
            id={`postAttributeValueInput-${field.id}`}
            name={`postAttributeValueInput-${field.name}`}
            data-testid={`post-attribute-input-${field.name}`}
            type='text'
            useLegend={false}
            containerClassName='PostAttributesModalRow__input'
            value={draft}
            disabled={disabled}
            aria-label={fieldLabel(field)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
        />
    );
}
