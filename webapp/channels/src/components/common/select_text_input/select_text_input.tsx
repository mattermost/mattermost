// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
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
    multiValue: (baseStyles: CSSProperties) => ({
        ...baseStyles,
        borderRadius: '10px',
        background: 'var(--center-channel-color-8, rgba(63, 67, 80, 0.08))',
        display: 'flex',
        alignItems: 'center',
    }),
    multiValueLabel: (baseStyles: CSSProperties) => ({
        ...baseStyles,
        padding: '4px 6px 4px 10px',
        color: 'var(--center-channel-color, #3F4350)',
        fontFamily: 'Open Sans',
        fontSize: '10px',
        fontWeight: 600,
        lineHeight: '12px',
        letterSpacing: '0.2px',
    }),
    multiValueRemove: (baseStyles: CSSProperties) => ({
        ...baseStyles,
        borderRadius: '50%',
        background: 'var(--center-channel-color-32, rgba(63, 67, 80, 0.32))',
        fontFamily: 'compass-icons',
        fontSize: '12px',
        fontWeight: 400,
        color: 'white',
        width: '10px',
        height: '10px',
        padding: 0,
        marginRight: '4px',
        ':hover': {
            background: 'var(--center-channel-color-32, rgba(63, 67, 80, 0.32))',
            color: 'white',
        },
    }),
};

const SelectTextInput = (props: Props) => {
    const [inputValue, setInputValue] = React.useState('');

    const handleKeyDown: KeyboardEventHandler = (event) => {
        if (!inputValue) {
            return;
        }
        switch (event.key) {
        case ' ':
        case ',':
            // do not add the value if already exists
            if (props.value?.includes(inputValue.trim())) {
                return;
            }
            props.handleNewSelection(inputValue);
            setInputValue('');
            event.preventDefault();
        }
    };

    return (
        <>
            <CreatableSelect
                id={props.id}
                className='select-text-input'
                styles={styles}
                components={components}
                isClearable={props.isClearable}
                onChange={(value) => props.onChange(value as SelectTextInputOption[])}
                inputValue={inputValue}
                isMulti={true}
                menuIsOpen={false}
                onInputChange={(newValue) => setInputValue(newValue)}
                onKeyDown={handleKeyDown}
                placeholder={props.placeholder}
                value={props.value.map((singleValue) => ({label: singleValue, value: singleValue}))}
            />
            {props.description ? <p className='select-text-description'>{props.description}</p> : undefined}
        </>
    );
};

export default SelectTextInput;
