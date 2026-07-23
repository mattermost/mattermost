// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import * as Menu from 'components/menu';

import Constants from 'utils/constants';

import {channelAttributeMenuItems, SelectedChannelAttributeLabel} from './channel_attribute_target';
import MaskedChip from './masked_chip';

import './selector_menus.scss';

// SingleValueSelector handles selection of a single value (operators like 'is', 'contains', etc.)
const SingleValueSelector = ({
    value,
    disabled,
    updateValue,
    options = [],
    allowCreateValue = false,
    placeholder,
    hasMaskedValues = false,
    channelFields = [],
    targetAttribute,
    onSelectTarget,
}: {
    value: string;
    disabled: boolean;
    updateValue: (value: string) => void;
    options?: PropertyFieldOption[];
    allowCreateValue?: boolean;
    placeholder?: string;
    hasMaskedValues?: boolean;
    channelFields?: UserPropertyField[];
    targetAttribute?: string;
    onSelectTarget?: (name: string) => void;
}) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const hasOptions = options.length > 0;
    const hasChannelFields = channelFields.length > 0;
    const inTargetMode = Boolean(targetAttribute);
    const selectedTarget = inTargetMode ? channelFields.find((cf) => cf.name === targetAttribute) : undefined;

    // Simple input logic for attributes without options
    const commitInputValue = useCallback(() => {
        const trimmedValue = inputValue.trim();
        if (trimmedValue) {
            updateValue(trimmedValue);
        }
        setInputValue('');
        setIsEditing(false);
    }, [inputValue, updateValue]);

    const handleKeyDownSimpleInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitInputValue();
        }
    }, [commitInputValue]);

    // The same free-text entry as the bare input, but living inside the menu
    // (atop the CHANNEL ATTRIBUTES list) — so keystrokes must not bubble to the
    // menu's own key handling.
    const handleKeyDownMenuInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Tab') {
            e.stopPropagation();
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            commitInputValue();
        }
    }, [commitInputValue]);

    // Filter logic for options
    const onFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    }, []);

    const filteredOptions = useMemo(() => {
        return options.filter((option) => {
            const name = option.name || '';
            return name.toLowerCase().includes(filter.toLowerCase());
        });
    }, [options, filter]);

    const defaultPlaceholder = formatMessage({
        id: 'admin.access_control.table_editor.value.select_value',
        defaultMessage: 'Select value',
    });

    const handleSelectItem = useCallback((name: string) => {
        updateValue(name);
        setFilter('');
    }, [updateValue]);

    const handleCreateValue = useCallback((valueToCreate: string) => {
        const trimmedValue = valueToCreate.trim();
        if (trimmedValue) {
            updateValue(trimmedValue);
        }
        setFilter('');
    }, [updateValue]);

    const handleInputKeyDownForMenu = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Tab') {
            e.stopPropagation();
        }

        if (e.key === 'Enter' && allowCreateValue && filter.trim()) {
            e.preventDefault();
            handleCreateValue(filter);
        }
    }, [allowCreateValue, filter, handleCreateValue]);

    // When masked values are present and the caller holds no visible value,
    // the row is effectively read-only — show only the masked chip.
    // Placed AFTER hook declarations so hook order stays stable when the
    // masked state changes between renders (e.g., parent re-renders after
    // a sibling rule is deleted).
    if (hasMaskedValues && !value && !inTargetMode) {
        return (
            <div className='values-editor'>
                <div className='value-selector-menu-button__multi-values-container'>
                    <MaskedChip/>
                </div>
            </div>
        );
    }

    if (!hasOptions && !hasChannelFields) {
        // For attributes without options and no channel targets, show a simple
        // inline input field.
        return (
            <div className='values-editor'>
                <input
                    type='text'
                    className='values-editor__simple-input'
                    value={isEditing ? inputValue : value}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDownSimpleInput}
                    onFocus={() => {
                        setIsEditing(true);
                        if (value) {
                            setInputValue(value);
                        }
                    }}
                    onBlur={commitInputValue}
                    placeholder={placeholder || formatMessage({
                        id: 'admin.access_control.table_editor.value.placeholder',
                        defaultMessage: 'Add value...',
                    })}
                    disabled={disabled}
                    maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                />
            </div>
        );
    }

    // Consolidated dropdown: literal value(s) atop a CHANNEL ATTRIBUTES list.
    const actualTextDisplayed = value || placeholder || defaultPlaceholder;
    const useStyle = actualTextDisplayed === defaultPlaceholder;

    return (
        <div className='values-editor'>
            <Menu.Container
                menuButton={{
                    id: 'value-selector-button',
                    class: classNames('btn field-selector-menu-button', {
                        disabled,
                    }),
                    children: (
                        <span className='value-selector-menu-button__inner-wrapper'>
                            {inTargetMode ? (
                                <SelectedChannelAttributeLabel
                                    field={selectedTarget}
                                    fallbackName={targetAttribute || ''}
                                />
                            ) : (
                                <span
                                    className={classNames({'value-selector-menu-button__placeholder': useStyle})}
                                >
                                    {actualTextDisplayed}
                                </span>
                            )}
                            <ChevronDownIcon
                                size={18}
                                color='rgba(var(--center-channel-color-rgb), 0.5)'
                            />
                        </span>
                    ),
                    dataTestId: 'valueSelectorMenuButton',
                    disabled,
                }}
                menu={{
                    id: 'value-selector-menu',
                    'aria-label': placeholder || defaultPlaceholder,
                    className: 'select-value-mui-menu',
                }}
            >
                {hasOptions ? (
                    <Menu.InputItem
                        key='filter_values'
                        id='filter_values'
                        type='text'
                        placeholder={formatMessage(allowCreateValue ? {
                            id: 'admin.access_control.table_editor.selector.filter_or_create',
                            defaultMessage: 'Search or create value...',
                        } : {
                            id: 'admin.access_control.table_editor.selector.filter_values',
                            defaultMessage: 'Search values...',
                        })}
                        className='attribute-selector-search'
                        value={filter}
                        onChange={onFilterChange}
                        onKeyDown={handleInputKeyDownForMenu}
                    />
                ) : (
                    <Menu.InputItem
                        key='value_text'
                        id='value_text'
                        type='text'
                        placeholder={placeholder || formatMessage({
                            id: 'admin.access_control.table_editor.value.placeholder',
                            defaultMessage: 'Add value...',
                        })}
                        className='attribute-selector-search'
                        value={isEditing ? inputValue : value}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={() => {
                            setIsEditing(true);
                            if (value) {
                                setInputValue(value);
                            }
                        }}
                        onBlur={commitInputValue}
                        onKeyDown={handleKeyDownMenuInput}
                        maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                    />
                )}
                {hasOptions && hasChannelFields && (
                    <Menu.Title role='presentation'>
                        {formatMessage({
                            id: 'admin.access_control.table_editor.rhs.values_section',
                            defaultMessage: 'Values',
                        })}
                    </Menu.Title>
                )}
                {hasOptions && filteredOptions.map((option) => {
                    const name = option.name || '';
                    const id = option.id || name;
                    const isSelected = value === name;

                    return (
                        <Menu.Item
                            id={`value-option-${id}`}
                            key={id}
                            role='menuitemradio'
                            forceCloseOnSelect={true}
                            aria-checked={isSelected}
                            onClick={() => handleSelectItem(name)}
                            labels={<span>{name}</span>}
                            trailingElements={isSelected && (
                                <CheckIcon/>
                            )}
                        />
                    );
                })}
                {hasOptions && allowCreateValue && filter.trim() && !filteredOptions.some((opt) => opt.name === filter.trim()) && (
                    <Menu.Item
                        id='create-value-option'
                        key='create-value-option'
                        onClick={() => handleCreateValue(filter)}
                        labels={<span>
                            {formatMessage({
                                id: 'admin.access_control.table_editor.create_value',
                                defaultMessage: 'Create "{value}"',
                            }, {value: filter.trim()})}
                        </span>}
                    />
                )}
                {onSelectTarget && channelAttributeMenuItems(channelFields, targetAttribute, onSelectTarget, formatMessage)}
            </Menu.Container>
        </div>
    );
};

export default SingleValueSelector;
