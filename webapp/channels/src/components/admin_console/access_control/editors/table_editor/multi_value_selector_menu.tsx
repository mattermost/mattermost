// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon, ChevronDownIcon, CloseIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

import './selector_menus.scss';

// MultiValueSelector handles selection of multiple values (operator 'in')
const MultiValueSelector = ({
    values,
    disabled,
    updateValues,
    options = [],
    allowCreateValue = false,
    placeholder,
}: {
    values: string[];
    disabled: boolean;
    updateValues: (values: string[]) => void;
    options?: PropertyFieldOption[];
    allowCreateValue?: boolean;
    placeholder?: string;
}) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const hasOptions = options.length > 0;
    const actualAllowCreateForMenu = hasOptions ? allowCreateValue : true;

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

    const defaultMultiPlaceholder = formatMessage({
        id: 'admin.access_control.table_editor.values.select_values',
        defaultMessage: 'Select values...',
    });

    const defaultCreatePlaceholder = formatMessage({
        id: 'admin.access_control.table_editor.values.create_placeholder',
        defaultMessage: 'Type to create value',
    });

    const handleSelectItem = useCallback((name: string) => {
        const newValues = values.includes(name) ?
            values.filter((v) => v !== name) :
            [...values, name];
        updateValues(newValues);
    }, [values, updateValues]);

    const handleCreateValue = useCallback((valueToCreate: string) => {
        const trimmedValue = valueToCreate.trim();
        if (!trimmedValue || values.includes(trimmedValue)) {
            return;
        }
        updateValues([...values, trimmedValue]);
        setFilter('');
    }, [values, updateValues]);

    const handleInputKeyDownForMenu = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Tab') {
            e.stopPropagation();
        }

        if (e.key === 'Enter' && actualAllowCreateForMenu && filter.trim()) {
            e.preventDefault();
            handleCreateValue(filter);
        }
    }, [actualAllowCreateForMenu, filter, handleCreateValue]);

    const handleRemoveValue = useCallback((event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, valueToRemove: string) => {
        event.stopPropagation();
        const newValues = values.filter((v) => v !== valueToRemove);
        updateValues(newValues);
    }, [values, updateValues]);

    // Memoize cell contents to prevent unnecessary re-renders
    const cellContents = useMemo(() => {
        if (values.length === 0) {
            let visualPlaceholderText = defaultMultiPlaceholder;
            if (actualAllowCreateForMenu && options.length === 0) {
                visualPlaceholderText = defaultCreatePlaceholder;
            }
            const actualTextDisplayed = placeholder || visualPlaceholderText;
            const useStyle = actualTextDisplayed === defaultMultiPlaceholder || actualTextDisplayed === defaultCreatePlaceholder;

            return (
                <span className={classNames({'value-selector-menu-button__placeholder': useStyle})}>
                    {actualTextDisplayed}
                </span>
            );
        }

        return (
            <div className='value-selector-menu-button__multi-values-container'>
                {values.map((value) => (
                    <div
                        key={value}
                        className='select__multi-value'
                    >
                        <div className='select__multi-value__label'>{value}</div>
                        {!disabled && (
                            <div
                                className='select__multi-value__remove'
                                onClick={(e) => handleRemoveValue(e, value)}
                                role='button'
                                tabIndex={0}
                                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handleRemoveValue(e, value);
                                    }
                                }}
                            >
                                <CloseIcon size={12}/>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }, [values, disabled]);

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
                            {cellContents}
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
                    'aria-label': placeholder || defaultMultiPlaceholder,
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
                    const isSelected = values.includes(name);

                    return (
                        <Menu.Item
                            id={`value-option-${id}`}
                            key={id}
                            role='menuitemcheckbox'
                            forceCloseOnSelect={false}
                            aria-checked={isSelected}
                            onClick={() => handleSelectItem(name)}
                            labels={<span>{name}</span>}
                            trailingElements={isSelected && (
                                <CheckIcon/>
                            )}
                        />
                    );
                })}
                {actualAllowCreateForMenu && filter.trim() && !filteredOptions.some((opt) => opt.name === filter.trim()) && (
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

export default MultiValueSelector;
