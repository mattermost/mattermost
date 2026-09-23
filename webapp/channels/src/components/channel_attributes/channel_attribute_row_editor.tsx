// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CheckIcon, ChevronDownIcon, CloseIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';
import {canMoveToOption, getPropertyFieldChangePolicy, getPropertyFieldLabel, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import * as Menu from 'components/menu';
import {asGraphFieldRef} from 'components/property_fields/graph';
import AssignmentGraphPicker from 'components/property_fields/hierarchical_value_menu/assignment_picker';

import AttributeChip, {AttributeChipRemoveButton} from './attribute_chip';
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

type RemovableChipProps = {
    label: string;
    value: string;
    color?: string;
    disabled?: boolean;
    onRemove: () => void;
};

// The remove control sits inside the chip, on its own background, so it reads as
// part of the value rather than as a stray icon next to it. A span, not a button:
// it lives inside the trigger's own <button>, and a nested button is invalid HTML.
// stopPropagation on both pointerdown and click keeps the removal from also
// toggling the trigger's menu open.
const RemovableChip = ({label, value, color, disabled, onRemove}: RemovableChipProps) => {
    const {formatMessage} = useIntl();

    return (
        <AttributeChip
            className='ChannelInfoAttributes__chip'
            label={label}
            value={value}
            color={color}
            size='medium'
            announceLabel={false}
        >
            {!disabled && (
                <span
                    className='ChannelInfoAttributes__chipRemove'
                    role='button'
                    tabIndex={0}
                    aria-label={formatMessage(
                        {id: 'channel_attributes.info.remove_value', defaultMessage: 'Remove {value}'},
                        {value},
                    )}
                    onPointerDown={(event) => {
                        if (event.button !== 0) {
                            return;
                        }
                        event.stopPropagation();
                        event.preventDefault();
                    }}
                    onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        onRemove();
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.stopPropagation();
                            event.preventDefault();
                            onRemove();
                        }
                    }}
                >
                    <CloseIcon size={12}/>
                </span>
            )}
        </AttributeChip>
    );
};

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

    // Unfiltered: a currently-selected option can fall outside a directional
    // change policy's reachable set (e.g. a lower rung under raise_only), and
    // still needs a label to render its chip.
    const allOptions = useMemo(() => toOptions(field), [field]);
    const optionById = useMemo(() => new Map(allOptions.map((option) => [option.value, option])), [allOptions]);

    const options = useMemo(
        () => allOptions.filter((option) => canMoveToOption(field, rawValue, option.value)),
        [allOptions, field, rawValue],
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

    // Memoized: the picker keys its own memos on field identity.
    const graphField = useMemo(() => (field.type === 'graph' ? asGraphFieldRef(field) : null), [field]);

    const handleGraphIdsChange = useCallback((next: string[]) => {
        onSubmit(next.length ? next : null);
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

    if (graphField) {
        return (
            <AssignmentGraphPicker
                field={graphField}
                ids={chosen}
                onIdsChange={handleGraphIdsChange}
                menuId={`channelAttributeEdit-${field.name}`}
                buttonId={`channelInfoAttributeEdit-${field.name}`}
                buttonDataTestId={`channelInfoAttributeEdit-${field.name}`}
                placeholder={formatMessage({
                    id: 'channel_attributes.info.not_set',
                    defaultMessage: 'Not set',
                })}
                ariaLabel={formatMessage(
                    {id: 'channel_attributes.info.edit', defaultMessage: 'Edit {label}'},
                    {label},
                )}
                disabled={saving}
            />
        );
    }

    // Multiselect renders one removable chip per value, boxed like the graph
    // attribute picker; single-select keeps its one-chip-plus-sibling-remove
    // layout, which the keyboard-only clear flow below is written against.
    const triggerChildren = isMultiselect ? (
        <span className='ChannelInfoAttributes__triggerInner'>
            {chosen.length > 0 ? (
                <span className='ChannelInfoAttributes__chips'>
                    {chosen.map((optionId) => {
                        const option = optionById.get(optionId);
                        return (
                            <RemovableChip
                                key={optionId}
                                label={label}
                                value={option?.label ?? optionId}
                                color={option?.color}
                                disabled={saving}
                                onRemove={() => handlePick(optionId)}
                            />
                        );
                    })}
                </span>
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
            )}
            <ChevronDownIcon
                size={16}
                aria-hidden={true}
            />
        </span>
    ) : (
        <span className='ChannelInfoAttributes__triggerInner'>
            {hasDisplay ? (
                <AttributeChip
                    className='ChannelInfoAttributes__chip'
                    label={label}
                    value={displayValue!}
                    color={color}
                    size='medium'
                    announceLabel={false}
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
            )}
            <ChevronDownIcon
                size={16}
                aria-hidden={true}
            />
        </span>
    );

    return (
        <span className='ChannelInfoAttributes__valueActive'>
            <Menu.Container
                menuButton={{
                    id: `channelInfoAttributeEdit-${field.name}`,
                    dataTestId: `channelInfoAttributeEdit-${field.name}`,
                    as: 'button',
                    class: 'ChannelInfoAttributes__valueTrigger',
                    disabled: saving,
                    'aria-label': formatMessage(
                        {id: 'channel_attributes.info.edit', defaultMessage: 'Edit {label}'},
                        {label},
                    ),
                    children: triggerChildren,
                }}
                menu={{
                    id: `channelAttributeEdit-${field.name}`,
                    'aria-label': label,
                }}
            >
                {clearable && hasDisplay && (
                    <Menu.Item
                        id={`channelAttributeClear-${field.name}`}
                        data-testid={`channelAttributeClear-${field.name}`}
                        onClick={() => onSubmit(null)}
                        labels={<span>{clearLabel}</span>}
                    />
                )}
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
            {!isMultiselect && clearable && hasDisplay && (
                <AttributeChipRemoveButton
                    onRemove={() => onSubmit(null)}
                    removeLabel={clearLabel}
                    disabled={saving}
                />
            )}
        </span>
    );
};

export default ChannelAttributeRowEditor;
