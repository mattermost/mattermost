// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';

import {getPropertyFieldLabel, getPropertyFieldOptions} from 'mattermost-redux/utils/property_utils';

import {UserSelector} from 'components/admin_console/content_flagging/user_multiselector/user_multiselector';
import * as Menu from 'components/menu';

import {resolveOption} from 'utils/property_options';

import PostAttributeText from './post_attribute_text';
import {hasValueControl, storedEntries} from './utils';

/*
 * Re-exported for the row, which has imported it from here since before the
 * picker needed it too. The definition moved to `utils.ts` so that
 * `useAddableAttributes` can read it without this module and that one importing
 * each other.
 */
export {hasValueControl};

type Props = {
    field: PropertyField;
    value?: PropertyValue<unknown>;
    disabled: boolean;
    onChange: (fieldId: string, next: unknown) => void;
};

/**
 * The control a modal row uses to write one attribute.
 *
 * Every shape calls the same `onChange(fieldId, next)`; none of them holds a copy
 * of the stored value for display, so there is never a staged value to reconcile
 * against the write's response or against somebody else's edit arriving over the
 * websocket — the row reads the store, always. The text control keeps a draft of
 * what is being typed, which is not the same thing — see `TextInput`.
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

    case 'user':
    case 'multiuser':
        return (
            <UserPicker
                field={field}
                value={value}
                disabled={disabled}
                onChange={onChange}
            />
        );

    case 'text':
        return (
            <TextInput
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

function storedText(value?: PropertyValue<unknown>): string {
    return typeof value?.value === 'string' ? value.value : '';
}

// Order matters: a value that names the same users in a different order is a
// different value, and the picker never reorders on its own anyway.
function sameEntries(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

/**
 * A menu of the field's options with a check on each chosen one.
 */
function OptionMenu({field, value, disabled, onChange}: Props) {
    const label = getPropertyFieldLabel(field);
    const isMulti = field.type === 'multiselect';
    const options = getPropertyFieldOptions(field);
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
            <span className='PostAttributesModalRow__readOnly'>
                <PostAttributeText
                    field={field}
                    value={value}
                />
            </span>
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
 *
 * A bare `<input>` rather than the `Input` widget: that widget draws a bordered
 * fieldset, which would make one row of the modal a form control while every
 * other row is a line of text. The styling matches the option menu's trigger, so
 * a text value and a select value sit at the same place and shade the same way
 * under the pointer.
 */
function TextInput({field, value, disabled, onChange}: Props) {
    const stored = storedText(value);
    const [draft, setDraft] = useState(stored);

    const handleBlur = useCallback(() => {
        if (draft !== stored) {
            onChange(field.id, draft);
        }
    }, [draft, stored, field.id, onChange]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
        }
    }, []);

    return (
        <input
            id={`postAttributeValueInput-${field.id}`}
            name={`postAttributeValueInput-${field.name}`}
            data-testid={`post-attribute-input-${field.name}`}
            type='text'
            className='PostAttributesModalRow__input'
            value={draft}
            disabled={disabled}
            aria-label={getPropertyFieldLabel(field)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
        />
    );
}

/**
 * A user picker, single or multi, over the same `UserSelector` the content
 * flagging admin screens and `SelectableUserPropertyRenderer` use.
 *
 * Despite the prop names, `UserSelector` is controlled: it derives what it
 * displays from `*InitialValue` on every render, not from state of its own. So
 * the stored ids are what it is handed, except while a Backspace removal is
 * waiting to be written — see `draft`. Nothing else is mirrored: while a write
 * is in flight the row still shows what the store holds, and it changes when
 * the store does. `SelectableUserPropertyRenderer` keeps a `useState` copy of
 * the whole value; that surface has no store to read back from, and this one
 * must not copy it.
 *
 * `multiuser` writes an array of ids and `user` writes a single id string,
 * which is the same split `storedEntries`, `MULTI_VALUED_TYPES` and `chipCount`
 * already make.
 *
 * The search is deliberately **unscoped** — no `searchFunc`, so `UserSelector`
 * searches every profile the current user may see rather than the channel's
 * members. Naming someone in a post attribute is not a claim that they can read
 * the channel, so membership is the wrong constraint.
 */
function UserPicker({field, value, disabled, onChange}: Props) {
    const {formatMessage} = useIntl();
    const isMulti = field.type === 'multiuser';

    // Memoised on the stored value rather than recomputed per render:
    // `UserSelector` keys an effect that fetches missing profiles off this
    // array's identity, so a fresh array every render is a dispatch every
    // render.
    const entries = useMemo(() => storedEntries(value), [value]);
    const [draft, setDraft] = useState<string[] | null>(null);
    const shown = draft ?? entries;

    // Set on the Backspace react-select is about to act on, so the change it
    // reports back can be told apart from a pick. A ref rather than state: it is
    // read inside the change that the same keystroke causes, before React has
    // rendered anything.
    const popping = useRef(false);

    /*
     * Capture, so this runs before react-select's own key handling: for
     * `multiuser` it has to mark the pop before react-select reports it, and the
     * two would otherwise race on the bubble.
     *
     * Only while the search box is empty, or it would take a name away on the
     * backspaces that edit a search term — the same condition react-select
     * itself applies.
     */
    const handleKeyDownCapture = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Backspace' || shown.length === 0) {
            return;
        }

        if ((event.target as HTMLInputElement).value !== '') {
            return;
        }

        if (isMulti) {
            // react-select pops the last name itself, and `handleMultiChange`
            // turns that into the draft.
            popping.current = true;
        } else {
            // `UserSelector` passes `isClearable: false`, which is what makes
            // react-select ignore Backspace on a single-valued control, so
            // there is nothing to intercept — the removal happens here.
            setDraft([]);
        }
    }, [isMulti, shown.length]);

    const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
        // Picking from the menu does not move the focus out of the control, so a
        // blur that leaves it is the user done editing.
        if (event.currentTarget.contains(event.relatedTarget) || draft === null) {
            return;
        }

        setDraft(null);

        if (!sameEntries(draft, entries)) {
            onChange(field.id, isMulti ? draft : (draft[0] ?? ''));
        }
    }, [draft, entries, field.id, isMulti, onChange]);

    const handleSingleChange = useCallback((userId: string) => {
        setDraft(null);
        onChange(field.id, userId);
    }, [field.id, onChange]);

    /*
     * Everything react-select reports for a multi control: a name picked, a name
     * removed through its pill's `×`, or the pop this component asked for.
     *
     * Only the pop is a draft. A pick writes — and writes what the control shows,
     * so a name added after a Backspace carries that removal with it — and the
     * `×` writes too, because clicking it is the whole gesture rather than the
     * start of typing another name.
     */
    const handleMultiChange = useCallback((userIds: string[]) => {
        if (popping.current) {
            popping.current = false;
            setDraft(userIds);
            return;
        }

        setDraft(null);
        onChange(field.id, userIds);
    }, [field.id, onChange]);

    const placeholder = (
        <span className='PostAttributesModalRow__userPlaceholder'>
            <i className='icon icon-account-outline'/>
            {formatMessage({id: 'generic.unassigned', defaultMessage: 'Unassigned'})}
        </span>
    );

    return (
        <div
            className='PostAttributesModalRow__users'
            data-testid={`post-attribute-user-${field.name}`}
            onKeyDownCapture={handleKeyDownCapture}
            onBlur={handleBlur}
        >
            <UserSelector
                id={`postAttributeValueUser-${field.id}`}
                isMulti={isMulti}
                disabled={disabled}
                showDropdownIndicator={true}
                placeholder={placeholder}
                singleSelectInitialValue={isMulti ? undefined : shown[0]}
                singleSelectOnChange={isMulti ? undefined : handleSingleChange}
                multiSelectInitialValue={isMulti ? shown : undefined}
                multiSelectOnChange={isMulti ? handleMultiChange : undefined}
            />
        </div>
    );
}
