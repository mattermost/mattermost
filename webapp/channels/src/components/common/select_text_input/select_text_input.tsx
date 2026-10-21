// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import type {KeyboardEventHandler} from 'react';

import {Combobox} from '@mattermost/compass-ui/components/combobox';

import './select_text_input.scss';

export interface SelectTextInputOption {
    label: string;
    value: string;
}

type Props = {
    placeholder: string;
    value: string[];
    handleNewSelection: (selection: string) => void;
    onChange: (option?: readonly SelectTextInputOption[] | null) => void;
    id?: string;
    isClearable?: boolean;
    description?: string;
    'aria-label'?: string;
};

const SelectTextInput = ({placeholder, value, handleNewSelection, onChange, id, description, 'aria-label': ariaLabel}: Props) => {
    const [inputValue, setInputValue] = React.useState('');

    const commitInput = useCallback(() => {
        const trimmed = inputValue.trim();
        if (value?.includes(trimmed) || trimmed.length === 0) {
            return;
        }
        handleNewSelection(trimmed);
        setInputValue('');
    }, [handleNewSelection, inputValue, value]);

    const handleKeyDown: KeyboardEventHandler = useCallback((event) => {
        if (!inputValue) {
            return;
        }
        switch (event.key) {
        case ' ':
        case ',':
        case 'Enter':
            commitInput();
            event.preventDefault();
        }
    }, [inputValue, commitInput]);

    const selectedOptions = useMemo(() => {
        return value.map((singleValue) => ({label: singleValue, value: singleValue}));
    }, [value]);

    const handleComboboxChange = useCallback((newValue: string | string[] | null) => {
        if (!Array.isArray(newValue)) {
            onChange([]);
            return;
        }
        onChange(newValue.map((singleValue) => ({label: singleValue, value: singleValue})));
    }, [onChange]);

    const handleCreateOption = useCallback((createdValue: string) => {
        const trimmed = createdValue.trim();
        if (trimmed.length === 0 || value.includes(trimmed)) {
            setInputValue('');
            return;
        }
        handleNewSelection(trimmed);
        setInputValue('');
    }, [handleNewSelection, value]);

    return (
        <div
            className='select-text-input'
            onKeyDown={handleKeyDown}
            onBlur={commitInput}
        >
            <Combobox
                id={id}
                multiple={true}
                creatable={true}
                options={[]}
                selectedOptions={selectedOptions}
                value={value}
                inputValue={inputValue}
                onInputChange={setInputValue}
                onCreateOption={handleCreateOption}
                onChange={handleComboboxChange}
                placeholder={placeholder}
                aria-label={ariaLabel}
                filter={false}
            />
            {description ? <p className='select-text-description'>{description}</p> : undefined}
        </div>
    );
};

export default SelectTextInput;
