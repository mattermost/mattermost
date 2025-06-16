// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

import Constants from 'utils/constants';

import './selector_menus.scss';

// SingleValueSelector handles selection of a single value (operators like 'is', 'contains', etc.)
const SingleValueSelector = ({
    value,
    disabled,
    updateValue,
    options = [],
    allowCreateValue = false,
    placeholder,
}: {
    value: string;
    disabled: boolean;
    updateValue: (value: string) => void;
    options?: PropertyFieldOption[];
    allowCreateValue?: boolean;
    placeholder?: string;
}) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const hasOptions = options.length > 0;

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

    if (!hasOptions) {
        // For attributes without options, show simple input field
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

    // For attributes with options, show dropdown menu
    const actualTextDisplayed = value || placeholder || defaultPlaceholder;
    const useStyle = actualTextDisplayed === defaultPlaceholder;

    return (
        <div className='values-editor'>
            <Menu.Container
                menuButton={{
                    id: 'value-selector-button',
                    class: classNames('btn btn-transparent field-selector-menu-button', {
                        disabled,
                    }),
                    children: (
                        <span className='value-selector-menu-button__inner-wrapper'>
                            <span
                                className={classNames({'value-selector-menu-button__placeholder': useStyle})}
                            >
                                {actualTextDisplayed}
                            </span>
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
                <Menu.InputItem
                    key='filter_values'
                    id='filter_values'
                    type='text'
                    placeholder={formatMessage({
                        id: 'admin.access_control.table_editor.selector.filter_or_create',
                        defaultMessage: 'Search or create value...',
                    })}
                    className='attribute-selector-search'
                    value={filter}
                    onChange={onFilterChange}
                    onKeyDown={handleInputKeyDownForMenu}
                />
                {filteredOptions.map((option) => {
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
                {allowCreateValue && filter.trim() && !filteredOptions.some((opt) => opt.name === filter.trim()) && (
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
            </Menu.Container>
        </div>
    );
};

export default SingleValueSelector;
