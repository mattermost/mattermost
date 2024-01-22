// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useRef} from 'react';
import type {CSSProperties} from 'react';
import ReactSelect, {components} from 'react-select';
import type {Props as SelectProps, IndicatorContainerProps, ControlProps, OptionProps} from 'react-select';

import 'components/widgets/inputs/input/input.scss';
import './dropdown_input_hybrid.scss';

type OptionType = {
    label: string | JSX.Element;
    value: string;
}

type Props<T extends OptionType> = Omit<SelectProps<T>, 'onChange'> & {
    value: T;
    legend?: string;
    error?: string;
    onDropdownChange: (value: T) => void;
    onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
    className?: string;
    name?: string;
    exceptionToInput: string[];
    width: number;
    inputValue: string;
    inputType?: string;
    defaultValue: T;
    dropdownClassNamePrefix?: string;
    inputId?: string;
};

const baseStyles = {
    input: (provided: CSSProperties) => ({
        ...provided,
        color: 'var(--center-channel-color)',
    }),
    control: (provided: CSSProperties) => ({
        ...provided,
        border: 'none',
        boxShadow: 'none',
        padding: '0 2px',
        cursor: 'pointer',
        minHeight: '40px',
        borderRadius: '0',
    }),
    indicatorSeparator: (provided: CSSProperties) => ({
        ...provided,
        display: 'none',
    }),
    menuPortal: (provided: CSSProperties) => ({
        ...provided,
        zIndex: 99999999,
    }),
};

const IndicatorsContainer = (props: IndicatorContainerProps<OptionType>) => (
    <div className='DropdownInput__indicatorsContainer'>
        <components.IndicatorsContainer {...props}>
            <i className='icon icon-chevron-down'/>
        </components.IndicatorsContainer>
    </div>
);

const Control = (props: ControlProps<OptionType>) => (
    <div className='DropdownInput__controlContainer'>
        <components.Control {...props}/>
    </div>
);

const Option = (props: OptionProps<OptionType>) => (
    <div
        className={classNames('DropdownInput__option', {
            selected: props.isSelected,
            focused: props.isFocused,
        })}
    >
        <components.Option {...props}/>
    </div>
);

const DropdownInputHybrid = <T extends OptionType = OptionType>(props: Props<T>) => {
    const {
        value,
        placeholder,
        className,
        name,
        legend,
        onDropdownChange,
        onInputChange,
        error,
        exceptionToInput,
        width,
        inputValue,
        inputType,
        defaultValue,
        dropdownClassNamePrefix,
        inputId,
        ...otherProps
    } = props;

    const containerRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputFocused, setInputFocused] = useState(false);
    const [focused, setFocused] = useState(false);
    const [showInput, setShowInput] = useState(Boolean(inputValue));

    useEffect(() => {
        if (showInput && !inputValue) {
            inputRef.current?.focus();
        }
    }, [showInput]);

    useEffect(() => {
        if (!inputFocused) {
            showTextInput(inputValue, false);
        }
    }, [inputValue]);

    useEffect(() => {
        if (!inputValue && !focused && !inputFocused) {
            onDropdownChange(defaultValue);
            showTextInput('');
        }
    }, [focused, inputFocused]);

    const getMenuStyles = () =>
        (showInput ? {
            menu: (provided: CSSProperties) => ({
                ...provided,
                width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '0px',
                left: inputRef.current ? `-${inputRef.current.offsetWidth}px` : '0px',
            }),
        } : {});

    const onInputBlur = () => setInputFocused(false);

    const onInputFocus = () => setInputFocused(true);

    const onDropdownInputFocus = (event: React.FocusEvent<HTMLElement>) => {
        setFocused(true);

        props.onFocus?.(event);
    };

    const onDropdownInputBlur = (event: React.FocusEvent<HTMLElement>) => {
        setFocused(false);

        props.onBlur?.(event);
    };

    const onValueChange = (event: T) => {
        showTextInput(event.value);

        onDropdownChange(event);
    };

    // We want to show the text input when we have a dropdown value selected and
    const showTextInput = (val: string, focus = true) => {
        if (!val || exceptionToInput.includes(val)) {
            setShowInput(false);
        } else {
            setShowInput(true);
            if (focus) {
                inputRef.current?.focus();
            }
        }
    };

    const showLegend = Boolean(focused || value);

    return (
        <div
            className='DropdownInput hybrid_container'
            ref={containerRef}
            style={{
                width: '100%',
            }}
        >
            <fieldset
                className={classNames('Input_fieldset', className, {
                    Input_fieldset___error: error,
                    Input_fieldset___legend: showLegend,
                    Input_fieldset___split: showInput,
                })}
            >
                <legend className={classNames('Input_legend', {Input_legend___focus: showLegend})}>
                    {showLegend ? (legend || placeholder) : null}
                </legend>
                <div
                    className={classNames('Input_wrapper input_hybrid_wrapper', {showInput})}
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
                    style={{
                        maxWidth: showInput ? '10000px' : '0',
                    }}
                >
                    <input
                        name={`Input_${name}`}
                        type={inputType || 'text'}
                        value={inputValue}
                        onChange={onInputChange}
                        placeholder={placeholder}
                        required={false}
                        className={classNames('Input form-control')}
                        ref={inputRef}
                        id={inputId}
                        disabled={props.disabled}
                    />
                </div>
                <div
                    className={classNames('Input_wrapper dropdown_hybrid_wrapper', {showInput: !showInput})}
                    onFocus={onDropdownInputFocus}
                    onBlur={onDropdownInputBlur}
                    style={{
                        width: showInput ? `${width}px` : '100%',
                    }}
                >
                    <ReactSelect
                        id={`DropdownInput_${name}`}
                        placeholder={focused ? '' : placeholder}
                        components={{
                            IndicatorsContainer,
                            Option,
                            Control,
                        }}
                        className={classNames('Input', className, {Input__focus: showLegend})}
                        classNamePrefix={dropdownClassNamePrefix}
                        onChange={onValueChange as any}
                        styles={{...baseStyles, ...getMenuStyles()}}
                        value={value}
                        hideSelectedOptions={true}
                        isSearchable={false}
                        menuPortalTarget={document.body}
                        isDisabled={props.disabled}
                        {...otherProps}
                    />
                </div>
            </fieldset>
        </div>
    );
};

export default DropdownInputHybrid;
