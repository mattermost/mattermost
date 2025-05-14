// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useMemo} from 'react';
import {useIntl} from 'react-intl';

import {CheckIcon, ChevronDownIcon, CloseIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';

import './selector_menus.scss';
import './values_editor.scss';

interface ValueSelectorMenuProps {
    currentValues: string[];
    options: PropertyFieldOption[];
    disabled: boolean;
    onChange: (values: string[]) => void;
    placeholder?: string;
    isMulti?: boolean;
    allowCreate?: boolean;
}

const ValueSelectorMenu = ({
    currentValues,
    options,
    disabled,
    onChange,
    placeholder,
    isMulti = false,
    allowCreate = false,
}: ValueSelectorMenuProps) => {
    const {formatMessage} = useIntl();
    const [filter, setFilter] = useState('');

    const onFilterChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    }, []);

    const filteredOptions = useMemo(() => {
        return options.filter((option) => {
            const name = option.name || '';
            return name.toLowerCase().includes(filter.toLowerCase());
        });
    }, [options, filter]);

    const defaultSinglePlaceholder = formatMessage({
        id: 'admin.access_control.table_editor.value.select_value',
        defaultMessage: 'Select value',
    });

    const defaultMultiPlaceholder = formatMessage({
        id: 'admin.access_control.table_editor.values.select_values',
        defaultMessage: 'Select values...',
    });

    const defaultCreatePlaceholder = formatMessage({
        id: 'admin.access_control.table_editor.values.create_placeholder',
        defaultMessage: 'Type to create value',
    });

    const handleSelectItem = React.useCallback((name: string) => {
        let newValues;
        if (isMulti) {
            newValues = currentValues.includes(name) ?
                currentValues.filter((v) => v !== name) :
                [...currentValues, name];
        } else {
            newValues = [name];
            setFilter('');
        }
        onChange(newValues);
    }, [isMulti, currentValues, onChange]);

    const handleCreateValue = React.useCallback((valueToCreate: string) => {
        const trimmedValue = valueToCreate.trim();
        if (!trimmedValue || currentValues.includes(trimmedValue)) {
            return;
        }
        let newValues;
        if (isMulti) {
            newValues = [...currentValues, trimmedValue];
        } else {
            newValues = [trimmedValue];
        }
        onChange(newValues);
        setFilter('');
    }, [currentValues, isMulti, onChange]);

    const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && allowCreate && filter.trim()) {
            e.preventDefault();
            handleCreateValue(filter);
        }
    }, [allowCreate, filter, handleCreateValue]);

    const handleRemoveValue = React.useCallback((event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>, valueToRemove: string) => {
        event.stopPropagation();
        const newValues = currentValues.filter((v) => v !== valueToRemove);
        onChange(newValues);
    }, [currentValues, onChange]);

    const getButtonContents = () => {
        if (isMulti) {
            if (currentValues.length === 0) {
                let visualPlaceholder = defaultMultiPlaceholder;
                if (allowCreate && options.length === 0) {
                    visualPlaceholder = defaultCreatePlaceholder;
                }
                return <span>{placeholder || visualPlaceholder}</span>;
            }
            return (
                <div className='value-selector-menu-button__multi-values-container'>
                    {currentValues.map((value) => (
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
        }
        return <span>{currentValues[0] || placeholder || defaultSinglePlaceholder}</span>;
    };

    let menuAriaLabelPlaceholder;
    if (isMulti) {
        if (allowCreate && options.length === 0) {
            menuAriaLabelPlaceholder = defaultCreatePlaceholder;
        } else {
            menuAriaLabelPlaceholder = defaultMultiPlaceholder;
        }
    } else {
        menuAriaLabelPlaceholder = defaultSinglePlaceholder;
    }

    return (
        <Menu.Container
            menuButton={{
                id: 'value-selector-button',
                class: classNames('btn btn-transparent field-selector-menu-button', {
                    disabled,
                }),
                children: (
                    <span className='value-selector-menu-button__inner-wrapper'>
                        {getButtonContents()}
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
                'aria-label': placeholder || menuAriaLabelPlaceholder,
                className: 'select-value-mui-menu',
            }}
        >
            <Menu.InputItem
                key='filter_values'
                id='filter_values'
                type='text'
                placeholder={
                    formatMessage({id: 'admin.access_control.table_editor.selector.filter_or_create', defaultMessage: 'Search or create value...'})}
                className='attribute-selector-search'
                value={filter}
                onChange={onFilterChange}
                onKeyDown={handleInputKeyDown}
            />
            {filteredOptions.map((option) => {
                const name = option.name || '';
                const id = option.id || name;
                const isSelected = isMulti ? currentValues.includes(name) : currentValues[0] === name;

                return (
                    <Menu.Item
                        id={`value-option-${id}`}
                        key={id}
                        role={isMulti ? 'menuitemcheckbox' : 'menuitemradio'}
                        forceCloseOnSelect={!isMulti}
                        aria-checked={isSelected}
                        onClick={() => handleSelectItem(name)}
                        labels={<span>{name}</span>}
                        trailingElements={isSelected && (
                            <CheckIcon/>
                        )}
                    />
                );
            })}
        </Menu.Container>
    );
};

export default ValueSelectorMenu;
