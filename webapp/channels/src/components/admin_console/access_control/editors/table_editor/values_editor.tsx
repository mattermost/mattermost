// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

// CreatableSelect is no longer needed if ValueSelectorMenu handles all cases
// import CreatableSelect from 'react-select/creatable';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import Constants from 'utils/constants';

import ValueSelectorMenu from './value_selector_menu';

import './values_editor.scss';

export interface TableRow {
    attribute: string;
    operator: string;
    values: string[];
}

export type ValuesEditorProps = {
    row: TableRow;
    disabled: boolean;
    updateValues: (values: string[]) => void;
    options?: PropertyFieldOption[];
    allowCreateValue?: boolean; // Prop to control if ValueSelectorMenu can create when it has options
}

function ValuesEditor({
    row,
    disabled,
    updateValues,
    options = [],

    // allowCreateValue is now more about whether creation is permitted *when options exist*
    // or if ValueSelectorMenu is used for single-select with options.
    // For no-options multi-select, ValueSelectorMenu is always creatable.
    // For no-options single-select, it's always a simple input.
    allowCreateValue = false,
}: ValuesEditorProps) {
    const {formatMessage} = useIntl();
    const isMultiOperator = row.operator === 'in';
    const [inputValue, setInputValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const hasOptions = options.length > 0;

    const commitInputValue = () => {
        const trimmedValue = inputValue.trim();
        if (trimmedValue) {
            updateValues([trimmedValue]);
        }
        setInputValue('');
        setIsEditing(false);
    };

    const handleKeyDownSimpleInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitInputValue();
        }
    };

    if (hasOptions) {
        // Always use ValueSelectorMenu if options are present
        return (
            <div className='values-editor'>
                <ValueSelectorMenu
                    currentValues={row.values}
                    options={options}
                    disabled={disabled}
                    onChange={updateValues}
                    isMulti={isMultiOperator}
                    allowCreate={allowCreateValue} // Allow creation alongside options if specified
                />
            </div>
        );
    }

    // No options present
    if (isMultiOperator) {
        // Multi-select, no options: Use ValueSelectorMenu, always creatable
        return (
            <div className='values-editor'>
                <ValueSelectorMenu
                    currentValues={row.values}
                    options={[]} // No options
                    disabled={disabled}
                    onChange={updateValues}
                    isMulti={true}
                    allowCreate={true} // Always allow create for multi-select with no options
                />
            </div>
        );
    }

    // Single-select, no options: Always use simple text input
    const displayValue = row.values.length > 0 ? row.values[0] : '';
    return (
        <div className='values-editor'>
            <input
                type='text'
                className='values-editor__simple-input'
                value={isEditing ? inputValue : displayValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDownSimpleInput}
                onFocus={() => {
                    setIsEditing(true);
                    if (displayValue) {
                        setInputValue(displayValue);
                    }
                }}
                onBlur={commitInputValue}
                placeholder={formatMessage({id: 'admin.access_control.table_editor.value.placeholder', defaultMessage: 'Add value...'})}
                disabled={disabled}
                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
            />
        </div>
    );
}

export default ValuesEditor;
