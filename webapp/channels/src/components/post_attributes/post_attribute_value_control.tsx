// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';

import {getPropertyFieldLabel, getPropertyFieldOptions, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

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

    // The scope of the control's test ids (`<scope>.attribute.value--button` and the rest). Without one, such as
    // in the composer, the ids are the plain ones.
    testIdScope?: string;
    field: PropertyField;
    value?: PropertyValue<unknown>;
    disabled: boolean;
    onChange: (fieldId: string, next: unknown) => void;

    // Replaces the field label as `OptionMenu`'s accessible name. The composer's
    // chip shows only the value, so it passes "Field: value" for screen readers.
    // `TextInput` and `UserPicker` ignore it: their content already reads out
    // the value.
    ariaLabel?: string;

    // Replaces `OptionMenu`'s plain-text `PostAttributeText` display of the
    // current value, so the composer can render it as the sent post's chip.
    renderValue?: (field: PropertyField, value: PropertyValue<unknown>) => React.ReactNode;

    // Opens the menu, or focuses the input, on mount, so a field just picked in
    // the composer can be given a value without hunting for its control.
    autoOpen?: boolean;

    // Shown by `OptionMenu` in place of the value while the field has none, so
    // its trigger has something to draw and a size to click. The composer
    // passes the field's name; the modal passes nothing and keeps its empty
    // trigger.
    pendingLabel?: React.ReactNode;

    // Called by `OptionMenu` when its menu closes and the field still has no
    // value. The composer un-stages the field; the modal never passes it.
    onCloseEmpty?: () => void;

    // The option trigger's tooltip, shown on hover and focus. The composer's
    // option chips show only the value, so they pass the field's name; the
    // modal's rows label themselves. Text and user controls take none: the
    // composer shows them only while editing, and its resting chip carries
    // the tooltip.
    tooltip?: string;

    // A floor for `OptionMenu`'s menu width, so a menu of short options isn't
    // narrower than the chip row around it. The composer passes one; the
    // modal's menus size to their content.
    menuMinWidth?: string;
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
export default function PostAttributeValueControl({testIdScope, field, value, disabled, onChange, ariaLabel, renderValue, autoOpen, pendingLabel, onCloseEmpty, tooltip, menuMinWidth}: Props) {
    switch (field.type) {
    case 'select':
    case 'rank':
    case 'multiselect':
        return (
            <OptionMenu
                testIdScope={testIdScope}
                field={field}
                value={value}
                disabled={disabled}
                onChange={onChange}
                ariaLabel={ariaLabel}
                renderValue={renderValue}
                autoOpen={autoOpen}
                pendingLabel={pendingLabel}
                onCloseEmpty={onCloseEmpty}
                tooltip={tooltip}
                menuMinWidth={menuMinWidth}
            />
        );

    case 'user':
    case 'multiuser':
        return (
            <UserPicker
                testIdScope={testIdScope}
                field={field}
                value={value}
                disabled={disabled}
                onChange={onChange}
                autoOpen={autoOpen}
            />
        );

    case 'text':
        return (
            <TextInput
                key={storedText(value)}
                testIdScope={testIdScope}
                field={field}
                value={value}
                disabled={disabled}
                onChange={onChange}
                autoOpen={autoOpen}
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
function OptionMenu({testIdScope, field, value, disabled, onChange, ariaLabel, renderValue, autoOpen, pendingLabel, onCloseEmpty, tooltip, menuMinWidth}: Props) {
    const label = ariaLabel ?? getPropertyFieldLabel(field);
    const isMulti = field.type === 'multiselect';
    const options = getPropertyFieldOptions(field);
    const entries = storedEntries(value);

    // The centre channel and the thread sidebar each mount their own composer,
    // and both draw a chip for the same field, so the field id alone would put
    // the same DOM id on two controls.
    const instanceId = useId();

    // Controlled only so `autoOpen` can open the menu on mount; like a native
    // `autoFocus`, it is read once. `onToggle` follows every other open and
    // close, so without `autoOpen` this behaves as the uncontrolled menu did.
    const [isOpen, setIsOpen] = useState(Boolean(autoOpen));

    // Whether the field holds a value after the last pick. A single-choice pick
    // runs in the same click that closes the menu, and the close is reported
    // after that click's re-render but before the editor's new value reaches
    // this component, so `value` alone would still read empty and un-stage the
    // field the user just picked.
    const hasValue = useRef(Boolean(value));
    useEffect(() => {
        hasValue.current = Boolean(value);
    }, [value]);

    // `Menu` also reports `false` on mount, when nothing was ever open; only a
    // menu that was open can be closed empty.
    const wasOpen = useRef(false);
    const handleToggle = useCallback((open: boolean) => {
        setIsOpen(open);

        if (open) {
            wasOpen.current = true;
            return;
        }

        if (wasOpen.current && !hasValue.current) {
            onCloseEmpty?.();
        }
        wasOpen.current = false;
    }, [onCloseEmpty]);

    let displayValue: React.ReactNode = pendingLabel ?? null;
    if (value) {
        displayValue = renderValue ? renderValue(field, value) : (
            <PostAttributeText
                field={field}
                value={value}
            />
        );
    }

    // A stored entry names an option by id or, for older data, by name — the same
    // two forms `resolveOption` accepts. Both are matched here so the check mark
    // and the chip cannot disagree about what is selected.
    const isSelected = (option: PropertyFieldOption) => entries.includes(option.id) || entries.includes(option.name);

    const handlePick = (option: PropertyFieldOption) => {
        if (!isMulti) {
            hasValue.current = true;
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

        const next = isSelected(option) ? normalised.filter((entry) => entry !== option.id) : [...normalised, option.id];

        hasValue.current = isPropertyValueSet(next);
        onChange(field.id, next);
    };

    if (options.length === 0) {
        return value ? (
            <span className='PostAttributesModalRow__readOnly'>
                {displayValue}
            </span>
        ) : null;
    }

    return (
        <Menu.Container
            menuButton={{
                id: `postAttributeValueTrigger-${field.id}-${instanceId}`,
                dataTestId: testIdScope ? `${testIdScope}.attribute.value--button` : `post-attribute-trigger-${field.name}`,
                class: 'PostAttributesModalRow__trigger',
                disabled,
                'aria-label': label,
                children: displayValue,
            }}
            menuButtonTooltip={tooltip ? {text: tooltip} : undefined}
            menu={{
                id: `postAttributeValueMenu-${field.id}-${instanceId}`,
                testId: testIdScope ? `${testIdScope}.attribute.value_menu` : undefined,
                'aria-label': label,
                isMenuOpen: isOpen,
                onToggle: handleToggle,
                minWidth: menuMinWidth,
            }}
        >
            {options.map((option) => {
                const checked = isSelected(option);

                return (
                    <Menu.Item
                        key={option.id}
                        id={`postAttributeOption-${field.id}-${option.id}`}
                        data-testid={testIdScope ? `${testIdScope}.attribute.value_menu.option:${option.id}--menuitem` : undefined}

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
function TextInput({testIdScope, field, value, disabled, onChange, autoOpen}: Props) {
    const instanceId = useId();
    const stored = storedText(value);
    const [draft, setDraft] = useState(stored);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focused from an effect rather than through `autoFocus`, which also
    // steals focus on any page load that happens to mount the input; this
    // only fires for the field the composer's picker just added.
    useEffect(() => {
        if (autoOpen) {
            inputRef.current?.focus();
        }
    }, [autoOpen]);

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
            id={`postAttributeValueInput-${field.id}-${instanceId}`}
            name={`postAttributeValueInput-${field.name}`}
            data-testid={testIdScope ? `${testIdScope}.attribute.value_input--textbox` : `post-attribute-input-${field.name}`}
            type='text'
            className='PostAttributesModalRow__input'
            value={draft}
            disabled={disabled}
            aria-label={getPropertyFieldLabel(field)}
            ref={inputRef}
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
function UserPicker({testIdScope, field, value, disabled, onChange, autoOpen}: Props) {
    const {formatMessage} = useIntl();
    const isMulti = field.type === 'multiuser';

    // `UserSelector` exposes neither a ref nor a way to open its menu, so the
    // search input it renders is focused directly. That is also the useful
    // gesture here: the menu is an async search with nothing to list until a
    // name is typed, so an opened menu would only say there are no results.
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (autoOpen) {
            containerRef.current?.querySelector('input')?.focus();
        }
    }, [autoOpen]);

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
            ref={containerRef}
            className='PostAttributesModalRow__users'
            data-testid={testIdScope ? `${testIdScope}.attribute.users` : `post-attribute-user-${field.name}`}
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
