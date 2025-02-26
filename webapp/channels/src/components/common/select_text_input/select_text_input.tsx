// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import type {CSSProperties, KeyboardEventHandler} from 'react';
import CreatableSelect from 'react-select/creatable';

import './select_text_input.scss';

const components = {
    DropdownIndicator: null,
};

export interface SelectTextInputOption {
    label: string;
    value: string;
}

type Props = {
    placeholder: string;
    value: string[];
    handleNewSelection: (selection: string) => void;
    onChange: (option?: SelectTextInputOption[] | null) => void;
    id?: string;
    isClearable?: boolean;
    description?: string;
}

const styles = {
    control: (baseStyles: CSSProperties) => ({
        ...baseStyles,
        background: 'var(--center-channel-color-rgb)',
    }),
    input: (baseStyles: CSSProperties) => ({
        ...baseStyles,
        color: 'rgba(var(--center-channel-color-rgb), 0.64)',
    }),
    multiValue: (baseStyles: CSSProperties) => ({
        ...baseStyles,
        borderRadius: '10px',
        background: 'rgba(var(--center-channel-color-rgb), 0.08)',
        display: 'flex',
        alignItems: 'center',
    }),
    multiValueLabel: (baseStyles: CSSProperties) => ({
        ...baseStyles,
        padding: '4px 6px 4px 10px',
        color: 'var(--center-channel-color)',
        fontFamily: 'Open Sans',
        fontSize: '10px',
        fontWeight: 600,
        lineHeight: '12px',
        letterSpacing: '0.2px',
    }),
    multiValueRemove: (baseStyles: CSSProperties) => ({
        ...baseStyles,
        borderRadius: '50%',
        background: 'rgba(var(--center-channel-color-rgb), 0.32)',
        fontFamily: 'compass-icons',
        fontSize: '12px',
        fontWeight: 400,
        color: 'white',
        width: '10px',
        height: '10px',
        padding: 0,
        marginRight: '4px',
        ':hover': {
            background: 'rgba(var(--center-channel-color-rgb), 0.32)',
            color: 'white',
        },
    }),
};

const SelectTextInput = ({placeholder, value, handleNewSelection, onChange, id, isClearable, description}: Props) => {
    const [inputValue, setInputValue] = React.useState('');

    const handleTextEnter = useCallback(() => {
        // do not add the value if already exists
        if (value?.includes(inputValue.trim()) || inputValue.length === 0) {
            return;
        }
        handleNewSelection(inputValue);
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
            handleTextEnter();
            event.preventDefault();
        }
    }, [inputValue, handleTextEnter]);

    const selectValues = useMemo(() => {
        return value.map((singleValue) => ({label: singleValue, value: singleValue}));
    }, [value]);

    return (
        <>
            <CreatableSelect
                id={id}
                className='select-text-input'
                styles={styles}
                components={components}
                isClearable={isClearable}
                onChange={useCallback((value) => onChange(value as SelectTextInputOption[]), [onChange])}
                inputValue={inputValue}
                isMulti={true}
                menuIsOpen={false}
                onInputChange={setInputValue}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                value={selectValues}
                onBlur={handleTextEnter}
            />
            {description ? <p className='select-text-description'>{description}</p> : undefined}
        </>
    );
};

export default SelectTextInput;
