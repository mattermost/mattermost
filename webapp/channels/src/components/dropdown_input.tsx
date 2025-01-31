// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import ReactSelect, {components} from 'react-select';
import type {Props as SelectProps, ActionMeta, StylesConfig} from 'react-select';

import InputError from 'components/input_error';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';

import {ItemStatus} from 'utils/constants';

import './dropdown_input.scss';

// TODO: This component needs work, should not be used outside of AddressInfo until this comment is removed.

export type ValueType = {
    label: string;
    value: string;
}

type Props<T extends ValueType> = Omit<SelectProps<T>, 'onChange'> & {
    value?: T;
    legend?: string;
    error?: string;
    onChange: (value: T, action: ActionMeta<T>) => void;
    testId?: string;
    required?: boolean;
};

const baseStyles = {
    input: (provided) => ({
        ...provided,
        color: 'var(--center-channel-color)',
    }),
    control: (provided) => ({
        ...provided,
        border: 'none',
        boxShadow: 'none',
        padding: '0 2px',
        cursor: 'pointer',
    }),
    indicatorSeparator: (provided) => ({
        ...provided,
        display: 'none',
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 100,
    }),
    menuPortal: (provided) => ({
        ...provided,
        zIndex: 100,
    }),
} satisfies StylesConfig<any>; // Using `StylesConfig<any>` because this is a legacy codebase, and the types for the options have not been fully updated to match the new react-select v5 type expectations;

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

const DropdownInput = <T extends ValueType>(props: Props<T>) => {
    const {value, placeholder, className, addon, name, textPrefix, legend, onChange, styles, options, error, testId, required, ...otherProps} = props as any; // types are not inferred correctly for `props` in react-select version v5.

    const [focused, setFocused] = useState(false);

    const onInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        const {onFocus} = props;

        setFocused(true);

        if (onFocus) {
            onFocus(event);
        }
    };

    const {formatMessage} = useIntl();
    const [customInputLabel, setCustomInputLabel] = useState<CustomMessageInputType>(null);
    const ownValue = useRef<T>();

    const ownOnChange = useCallback((value: T, action: ActionMeta<T>) => {
        ownValue.current = value;
        onChange(value, action);
    }, [onChange]);

    const validateInput = useCallback(() => {
        if (!required || (ownValue.current !== null && ownValue.current)) {
            setCustomInputLabel(null);
            return;
        }

        const validationErrorMsg = formatMessage({id: 'widget.input.required', defaultMessage: 'This field is required'});
        setCustomInputLabel({type: ItemStatus.ERROR, value: validationErrorMsg});
    }, [required, formatMessage]);

    const onInputBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
        setFocused(false);
        validateInput();

        if (otherProps.onBlur) {
            otherProps.onBlur(event);
        }
    }, [otherProps.onBlur, validateInput]);

    const showLegend = Boolean(focused || value);
    const isError = error || customInputLabel?.type === 'error';

    return (
        <div
            className='DropdownInput Input_container'
            data-testid={testId || ''}
        >
            <fieldset
                className={classNames('Input_fieldset', className, {
                    Input_fieldset___error: isError,
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
                        onChange={ownOnChange as any} // types are not working correctly for multiselect
                        styles={{...baseStyles, ...styles}}
                        {...otherProps}
                    />
                </div>
                {addon}
            </fieldset>
            <InputError
                message={error}
                custom={customInputLabel}
            />
        </div>
    );
};

export default DropdownInput;
