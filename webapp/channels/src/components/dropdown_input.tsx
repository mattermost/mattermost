// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useRef, useState} from 'react';
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
};

type Props<T extends ValueType> = Omit<SelectProps<T>, 'onChange'> & {
    value?: T;
    legend?: string;
    error?: string;
    onChange: (value: T, action: ActionMeta<T>) => void;
    testId?: string;
    required?: boolean;
    addon?: React.ReactNode;
    textPrefix?: React.ReactNode;
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
    group: (provided) => ({
        ...provided,
        paddingTop: 0,
        paddingBottom: 0,
    }),
    groupHeading: (provided) => ({
        ...provided,
        height: 1,
        margin: '4px 0',
        padding: 0,
        fontSize: 0,
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
    }),
} satisfies StylesConfig;

const IndicatorsContainer = (props: any) => {
    return (
        <div className='DropdownInput__indicatorsContainer'>
            <components.IndicatorsContainer {...props}>
                <i className='icon icon-chevron-down'/>
            </components.IndicatorsContainer>
        </div>
    );
};

const makeControl = (controlTestId?: string) => (props: any) => {
    return (
        <div className='DropdownInput__controlContainer'>
            <components.Control
                {...props}
                innerProps={{...props.innerProps, 'data-testid': controlTestId}}
            />
        </div>
    );
};

const makeOption = (testId?: string) => (props: any) => {
    // Grouped options nest the options in each group: count across all groups so every option's id is unique.
    const flatOptions = props.options.flatMap((option: any) => ('options' in option ? option.options : [option]));
    const position: number = flatOptions.indexOf(props.data);
    return (
        <div
            className={classNames('DropdownInput__option', {
                selected: props.isSelected,
                focused: props.isFocused,
            })}
        >
            <components.Option
                {...props}
                innerProps={{...props.innerProps, 'data-testid': testId ? `${testId}.menu.option:${position}--option` : undefined}}
            />
        </div>
    );
};

const makeMenu = (testId?: string) => (props: any) => {
    return (
        <components.Menu
            {...props}
            innerProps={{...props.innerProps, 'data-testid': testId ? `${testId}.menu` : 'dropdownMenu'}}
        />
    );
};

const DropdownInput = <T extends ValueType>(props: Props<T>) => {
    const {value, placeholder, className, addon, name, textPrefix, legend, onChange, styles, options, error, testId, required, ...otherProps} = props; // types are not inferred correctly for `props` in react-select version v5.

    const [focused, setFocused] = useState(false);

    const Menu = useMemo(() => makeMenu(testId), [testId]);
    const Control = useMemo(() => makeControl(testId ? `${testId}.control--button` : undefined), [testId]);
    const OptionWithTestId = useMemo(() => makeOption(testId), [testId]);

    const onInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        const {onFocus} = props;

        setFocused(true);

        if (onFocus) {
            onFocus(event);
        }
    };

    const {formatMessage} = useIntl();
    const [customInputLabel, setCustomInputLabel] = useState<CustomMessageInputType>(null);
    const ownValue = useRef<T>(undefined);

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
            data-testid={testId}
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
                            Control,
                            Menu,
                            Option: OptionWithTestId,
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
