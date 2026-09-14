// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';
import {canMoveToOption, getPropertyFieldChangePolicy, getPropertyFieldLabel, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import * as Menu from 'components/menu';

import AttributeChip from './attribute_chip';
import type {ChannelAttributeValue} from './set_channel_attribute_value';

type Option = {label: string; value: string; color?: string};

function toOptions(field: PropertyField): Option[] {
    const options = (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
    return options.map((option) => ({label: option.name, value: option.id, color: option.color}));
}

function selectedIds(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw.filter((id): id is string => typeof id === 'string');
    }
    if (typeof raw === 'string' && raw) {
        return [raw];
    }
    return [];
}

type Props = {
    field: PropertyField;
    rawValue: unknown;
    displayValue?: string;
    color?: string;
    onSubmit: (value: ChannelAttributeValue) => void;
    onCancel: () => void;
    saving: boolean;
};

/**
 * Option fields open a menu from the value itself. Text commits on blur or
 * Enter; Escape abandons.
 */
const ChannelAttributeRowEditor = ({field, rawValue, displayValue, color, onSubmit, onCancel, saving}: Props) => {
    const {formatMessage} = useIntl();

    const label = getPropertyFieldLabel(field);

    const isText = field.type === 'text';
    const isMultiselect = field.type === 'multiselect';

    const initialText = typeof rawValue === 'string' && !supportsOptions(field) ? rawValue : '';
    const [text, setText] = useState(initialText);

    const chosen = useMemo(() => selectedIds(rawValue), [rawValue]);

    const options = useMemo(
        () => toOptions(field).filter((option) => canMoveToOption(field, rawValue, option.value)),
        [field, rawValue],
    );

    const clearable = getPropertyFieldChangePolicy(field) === 'any' || !isPropertyValueSet(rawValue);
    const hasDisplay = Boolean(displayValue);
    const clearLabel = formatMessage(
        {id: 'channel_attributes.info.clear', defaultMessage: 'Clear {label}'},
        {label},
    );

    const handlePick = useCallback((optionId: string) => {
        if (isMultiselect) {
            const next = chosen.includes(optionId) ? chosen.filter((id) => id !== optionId) : [...chosen, optionId];
            onSubmit(next.length ? next : null);
            return;
        }
        onSubmit(optionId);
    }, [chosen, isMultiselect, onSubmit]);

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
            <input
                id={`channelAttributeEdit-${field.id}`}
                name={`channelAttributeEdit-${field.name}`}
                className='ChannelInfoAttributes__textInput'
                type='text'
                value={text}
                maxLength={PROPERTY_TEXT_VALUE_MAX_LENGTH}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleTextKeyDown}
                onBlur={() => {
                    if (text === initialText) {
                        onCancel();
                        return;
                    }
                    const next = text.trim();
                    onSubmit(next || null);
                }}
                disabled={saving}
                autoFocus={true}
                aria-label={label}
                data-testid={`channelAttributeEdit-${field.name}`}
            />
        );
    }

    return (
        <span className='ChannelInfoAttributes__valueActive'>
            <Menu.Container
                menuButton={{
                    id: `channelInfoAttributeEdit-${field.name}`,
                    dataTestId: `channelInfoAttributeEdit-${field.name}`,
                    as: 'div',
                    class: 'ChannelInfoAttributes__valueTrigger',
                    disabled: saving,
                    'aria-label': formatMessage(
                        {id: 'channel_attributes.info.edit', defaultMessage: 'Edit {label}'},
                        {label},
                    ),
                    onMouseDown: (event) => {
                        if ((event.target as HTMLElement).closest('[data-chip-remove]')) {
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    },
                    children: hasDisplay ? (
                        <AttributeChip
                            label={label}
                            value={displayValue!}
                            color={color}
                            size='medium'
                            announceLabel={false}
                            onRemove={clearable ? () => onSubmit(null) : undefined}
                            removeLabel={clearLabel}
                        />
                    ) : (
                        <span
                            className='ChannelInfoAttributes__empty'
                            data-testid={`channelInfoAttributeUnset-${field.name}`}
                        >
                            <FormattedMessage
                                id='channel_attributes.info.not_set'
                                defaultMessage='Not set'
                            />
                        </span>
                    ),
                }}
                menu={{
                    id: `channelAttributeEdit-${field.name}`,
                    'aria-label': label,
                }}
            >
                {options.map((option) => {
                    const selected = chosen.includes(option.value);
                    return (
                        <Menu.Item
                            key={option.value}
                            id={`channelAttributeEdit-${field.name}-${option.value}`}
                            data-testid={option === options[0] ? `channelAttributeEdit-${field.name}` : undefined}
                            labels={
                                <span className='ChannelInfoAttributes__optionLabel'>
                                    {option.color ? (
                                        <AttributeChip
                                            label={label}
                                            value={option.label}
                                            color={option.color}
                                            size='medium'
                                            announceLabel={false}
                                        />
                                    ) : (
                                        option.label
                                    )}
                                </span>
                            }
                            trailingElements={selected ? (
                                <CheckIcon
                                    size={16}
                                    aria-hidden={true}
                                />
                            ) : undefined}
                            onClick={() => handlePick(option.value)}
                        />
                    );
                })}
            </Menu.Container>
        </span>
    );
};

export default ChannelAttributeRowEditor;
