// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo} from 'react';
import {useIntl} from 'react-intl';
import CreatableSelect from 'react-select/creatable';

import Constants from 'utils/constants';

import './values_editor.scss';
import type {TableRow} from './table_row';

export type ValuesEditorProps = {
    row: TableRow;
    disabled: boolean;
    updateValues: (values: string[]) => void;
}

function ValuesEditor({row, disabled, updateValues}: ValuesEditorProps) {
    const {formatMessage} = useIntl();
    const isMulti = row.operator === 'in';
    const [inputValue, setInputValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Format options for react-select
    const value = useMemo(() => {
        return row.values.map((val) => ({
            label: val,
            value: val,
        }));
    }, [row.values]);

    // Handle input submission for single value
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            // Only update if there's actual text - don't set empty values
            if (inputValue.trim()) {
                updateValues([inputValue.trim()]);
            }
            setInputValue('');
            setIsEditing(false);
        }
    };

    // For single value mode, use a simple input field
    if (!isMulti) {
        const displayValue = row.values.length > 0 ? row.values[0] : '';

        return (
            <div className='values-editor'>
                <input
                    type='text'
                    className='values-editor__simple-input'
                    value={isEditing ? inputValue : displayValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        setIsEditing(true);
                        if (displayValue) {
                            setInputValue(displayValue);
                        }
                    }}
                    onBlur={() => {
                        // Only update if there's actual text - don't set empty values
                        if (inputValue.trim()) {
                            updateValues([inputValue.trim()]);
                        }
                        setInputValue('');
                        setIsEditing(false);
                    }}
                    placeholder={formatMessage({id: 'admin.access_control.table_editor.value.placeholder', defaultMessage: 'Add value...'})}
                    disabled={disabled}
                    maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                />
            </div>
        );
    }

    // For multi-value mode, continue using CreatableSelect
    const customComponents = {
        DropdownIndicator: () => null,
        IndicatorsContainer: () => null,
    };

    const handleChange = (newValue: any) => {
        if (!newValue) {
            updateValues([]);
        } else if (Array.isArray(newValue)) {
            updateValues(newValue.map((option) => option.value));
        }
    };

    return (
        <div className='values-editor'>
            <CreatableSelect
                isMulti={true}
                isClearable={true}
                isDisabled={disabled}
                components={customComponents}
                value={value}
                onChange={handleChange}
                onCreateOption={(inputValue) => {
                    const val = inputValue.trim();
                    if (!val) {
                        return;
                    }

                    if (!row.values.includes(val)) {
                        updateValues([...row.values, val]);
                    }
                }}
                placeholder={formatMessage({id: 'admin.access_control.table_editor.values.placeholder', defaultMessage: 'Add values...'})}
                classNamePrefix='select'
                menuPortalTarget={document.body}
            />
        </div>
    );
}

export default ValuesEditor;
