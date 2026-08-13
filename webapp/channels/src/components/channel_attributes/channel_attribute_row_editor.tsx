// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import type {OnChangeValue} from 'react-select';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import DropdownInput from 'components/dropdown_input';
import Input from 'components/widgets/inputs/input/input';

import type {ChannelAttributeValue} from './set_channel_attribute_value';

type Option = {label: string; value: string};

// Portalled to the body to escape the RHS's overflow, matching the create-modal
// form's reasoning.
const dropdownStyles = {
    menu: (provided: Record<string, unknown>) => ({...provided, zIndex: 100}),
    menuPortal: (provided: Record<string, unknown>) => ({...provided, zIndex: 1100}),
};

function toOptions(field: PropertyField): Option[] {
    const options = (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
    return options.map((option) => ({label: option.name, value: option.id}));
}

function currentSelection(field: PropertyField, raw: unknown): Option | undefined {
    const options = toOptions(field);
    if (Array.isArray(raw)) {
        return options.filter((option) => raw.includes(option.value)) as unknown as Option;
    }
    if (typeof raw === 'string') {
        return options.find((option) => option.value === raw);
    }
    return undefined;
}

type Props = {
    field: PropertyField;
    rawValue: unknown;
    onSubmit: (value: ChannelAttributeValue) => void;
    onCancel: () => void;
    saving: boolean;
};

/**
 * The edit control for a single attribute row.
 *
 * A select commits as soon as a choice is made — there is nothing else to
 * confirm, and a separate save step on a one-field row is friction. Text commits
 * on blur or Enter, and Escape abandons the edit.
 */
const ChannelAttributeRowEditor = ({field, rawValue, onSubmit, onCancel, saving}: Props) => {
    const {formatMessage} = useIntl();

    const isText = field.type === 'text';
    const isMultiselect = field.type === 'multiselect';

    const initialText = typeof rawValue === 'string' && !supportsOptions(field) ? rawValue : '';
    const [text, setText] = useState(initialText);

    const selected = useMemo(() => currentSelection(field, rawValue), [field, rawValue]);

    const handleSelect = useCallback((next: OnChangeValue<Option, boolean>) => {
        if (Array.isArray(next)) {
            const ids = next.map((option) => option.value);
            onSubmit(ids.length ? ids : null);
            return;
        }
        onSubmit((next as Option | null)?.value ?? null);
    }, [onSubmit]);

    const handleTextKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit(text.trim() || null);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
        }
    }, [text, onSubmit, onCancel]);

    if (isText) {
        return (
            <Input
                id={`channelAttributeEdit-${field.id}`}
                name={`channelAttributeEdit-${field.name}`}
                type='text'
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleTextKeyDown}

                // Only writes if the text actually changed. Opening a row and
                // clicking away is an abandoned edit, not a request to clear the
                // value, and it must not cost a round trip.
                onBlur={() => {
                    const next = text.trim();
                    if (next === initialText) {
                        onCancel();
                        return;
                    }
                    onSubmit(next || null);
                }}
                disabled={saving}
                autoFocus={true}
                placeholder={formatMessage({id: 'channel_attributes.enter_value', defaultMessage: 'Enter a value'})}
                aria-label={formatMessage({id: 'channel_attributes.enter_value', defaultMessage: 'Enter a value'})}
                data-testid={`channelAttributeEdit-${field.name}`}
            />
        );
    }

    return (
        <DropdownInput
            name={`channelAttributeEdit-${field.id}`}
            testId={`channelAttributeEdit-${field.name}`}
            options={toOptions(field)}
            value={selected}
            onChange={handleSelect}
            isMulti={isMultiselect}
            isClearable={true}
            isDisabled={saving}
            autoFocus={true}
            placeholder={formatMessage({id: 'channel_attributes.select_value', defaultMessage: 'Select a value'})}
            styles={dropdownStyles}
            menuPortalTarget={document.body}
        />
    );
};

export default ChannelAttributeRowEditor;
