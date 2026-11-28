// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import type {KeyboardEventHandler} from 'react';
import {components as selectComponents} from 'react-select';
import type {ContainerProps, InputProps, MultiValueRemoveProps, StylesConfig} from 'react-select';
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
    onChange: (option?: readonly SelectTextInputOption[] | null) => void;
    id?: string;
    isClearable?: boolean;
    description?: string;

    /**
     * Testid scope: the select is `<testId>`, its text input `<testId>.input--combobox`, and each value's
     * remove button `<testId>.remove--button` (values are free text, so they aren't keyed).
     */
    testId?: string;
};

const styles = {
    control: (baseStyles) => ({
        ...baseStyles,
        background: 'var(--center-channel-color-rgb)',
    }),
    input: (baseStyles) => ({
        ...baseStyles,
        color: 'rgba(var(--center-channel-color-rgb), 0.64)',
    }),
    multiValue: (baseStyles) => ({
        ...baseStyles,
        borderRadius: '10px',
        background: 'rgba(var(--center-channel-color-rgb), 0.08)',
        display: 'flex',
        alignItems: 'center',
    }),
    multiValueLabel: (baseStyles) => ({
        ...baseStyles,
        padding: '4px 6px 4px 10px',
        color: 'var(--center-channel-color)',
        fontFamily: 'Open Sans',
        fontSize: '10px',
        fontWeight: 600,
        lineHeight: '12px',
        letterSpacing: '0.2px',
    }),
    multiValueRemove: (baseStyles) => ({
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
} satisfies StylesConfig<SelectTextInputOption, true>;

const SelectTextInput = ({placeholder, value, handleNewSelection, onChange, id, isClearable, description, testId}: Props) => {
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

    // react-select's styles arrive in innerProps, so its own parts stay; the testids go in through innerProps (the
    // input takes extra props directly)
    const selectParts = useMemo(() => (testId ? {
        ...components,
        SelectContainer: (props: ContainerProps<SelectTextInputOption, true>) => (
            <selectComponents.SelectContainer
                {...props}
                innerProps={{...props.innerProps, 'data-testid': testId} as ContainerProps<SelectTextInputOption, true>['innerProps']}
            />
        ),
        Input: (props: InputProps<SelectTextInputOption, true>) => (
            <selectComponents.Input
                {...props}
                data-testid={testId ? `${testId}.input--combobox` : undefined}
            />
        ),
        MultiValueRemove: (props: MultiValueRemoveProps<SelectTextInputOption, true>) => (
            <selectComponents.MultiValueRemove
                {...props}
                innerProps={{...props.innerProps, 'data-testid': testId ? `${testId}.remove--button` : undefined} as MultiValueRemoveProps<SelectTextInputOption, true>['innerProps']}
            />
        ),
    } : components), [testId]);

    const selectValues = useMemo(() => {
        return value.map((singleValue) => ({label: singleValue, value: singleValue}));
    }, [value]);

    return (
        <>
            <CreatableSelect<SelectTextInputOption, true>
                id={id}
                className='select-text-input'
                styles={styles}
                components={selectParts}
                isClearable={isClearable}
                onChange={useCallback((value: readonly SelectTextInputOption[]) => onChange(value), [onChange])}
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
