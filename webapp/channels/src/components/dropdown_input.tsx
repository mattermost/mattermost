// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import type {CSSProperties} from 'react';
import ReactSelect, {components} from 'react-select';
import type {Props as SelectProps, ActionMeta} from 'react-select';

import './dropdown_input.scss';

// TODO: This component needs work, should not be used outside of AddressInfo until this comment is removed.

export type ValueType = {
    label: string;
    value: string;
}

type Props<T> = Omit<SelectProps<T>, 'onChange'> & {
    value?: T;
    legend?: string;
    error?: string;
    onChange: (value: T, action: ActionMeta<T>) => void;
    testId?: string;
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
    }),
    indicatorSeparator: (provided: CSSProperties) => ({
        ...provided,
        display: 'none',
    }),
};

const IndicatorsContainer = (props: any) => {
    return (
        <div className='DropdownInput__indicatorsContainer'>
            <components.IndicatorsContainer {...props}>
                <i className='icon icon-chevron-down'/>
            </components.IndicatorsContainer>
        </div>
    );
};

const Control = (props: any) => {
    return (
        <div className='DropdownInput__controlContainer'>
            <components.Control {...props}/>
        </div>
    );
};

const Option = (props: any) => {
    return (
        <div
            className={classNames('DropdownInput__option', {
                selected: props.isSelected,
                focused: props.isFocused,
            })}
        >
            <components.Option {...props}/>
        </div>
    );
};

const renderError = (error?: string) => {
    if (!error) {
        return null;
    }

    return (
        <div className='Input___error'>
            <i className='icon icon-alert-outline'/>
            <span>{error}</span>
        </div>
    );
};

const DropdownInput = <T extends ValueType>(props: Props<T>) => {
    const {value, placeholder, className, addon, name, textPrefix, legend, onChange, styles, options, error, testId, ...otherProps} = props;

    const [focused, setFocused] = useState(false);

    const onInputFocus = (event: React.FocusEvent<HTMLElement>) => {
        const {onFocus} = props;

        setFocused(true);

        if (onFocus) {
            onFocus(event);
        }
    };

    const onInputBlur = (event: React.FocusEvent<HTMLElement>) => {
        const {onBlur} = props;

        setFocused(false);

        if (onBlur) {
            onBlur(event);
        }
    };

    const showLegend = Boolean(focused || value);

    return (
        <div
            className='DropdownInput Input_container'
            data-testid={testId || ''}
        >
            <fieldset
                className={classNames('Input_fieldset', className, {
                    Input_fieldset___error: error,
                    Input_fieldset___legend: showLegend,
                })}
            >
                <legend className={classNames('Input_legend', {Input_legend___focus: showLegend})}>
                    {showLegend ? (legend || placeholder) : null}
                </legend>
                <div
                    className='Input_wrapper'
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
                >
                    {textPrefix && <span>{textPrefix}</span>}
                    <ReactSelect
                        id={`DropdownInput_${name}`}
                        options={options}
                        placeholder={focused ? '' : placeholder}
                        components={{
                            IndicatorsContainer,
                            Option,
                            Control,
                        }}
                        className={classNames('Input', className, {Input__focus: showLegend})}
                        classNamePrefix={'DropDown'}
                        value={value}
                        onChange={onChange as any} // types are not working correctly for multiselect
                        styles={{...baseStyles, ...styles}}
                        {...otherProps}
                    />
                </div>
                {addon}
            </fieldset>
            {renderError(error)}
        </div>
    );
};

export default DropdownInput;
