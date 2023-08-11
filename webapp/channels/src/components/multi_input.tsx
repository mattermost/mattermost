// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {CSSProperties} from 'react';
import ReactSelect, {components} from 'react-select';
import type {Props as SelectProps, ActionMeta} from 'react-select';

import classNames from 'classnames';

import './multi_input.scss';

// TODO: This component needs work, should not be used outside of InviteMembersStep until this comment is removed.

type ValueType = {
    label: string;
    value: string;
}

type Props<T> = Omit<SelectProps<T>, 'onChange'> & {
    value: T[];
    legend?: string;
    onChange: (value: T[], action: ActionMeta<T[]>) => void;
};

const baseStyles = {
    input: (provided: CSSProperties) => ({
        ...provided,
        color: 'var(--center-channel-color)',
    }),
};

const MultiValueContainer = (props: any) => {
    return (
        <div className={classNames('MultiInput__multiValueContainer', {error: props.data.error})}>
            <components.MultiValueContainer {...props}/>
        </div>
    );
};

const MultiValueRemove = (props: any) => {
    return (
        <div className='MultiInput__multiValueRemove'>
            <components.MultiValueRemove {...props}>
                <i className='icon icon-close-circle'/>
            </components.MultiValueRemove>
        </div>
    );
};

const Placeholder = (props: any) => {
    return (
        <div className='MultiInput__placeholder'>
            <components.Placeholder {...props}/>
        </div>
    );
};

const MultiInput = <T extends ValueType>(props: Props<T>) => {
    const {value, placeholder, className, addon, name, textPrefix, legend, onChange, styles, ...otherProps} = props;

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

    const showLegend = Boolean(focused || value.length);

    return (
        <div className='MultiInput Input_container'>
            <fieldset
                className={classNames('Input_fieldset', className, {
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
                        id={`MultiInput_${name}`}
                        components={{
                            Menu: () => null,
                            IndicatorsContainer: () => null,
                            MultiValueContainer,
                            MultiValueRemove,
                            Placeholder,
                        }}
                        isMulti={true}
                        isClearable={false}
                        openMenuOnFocus={false}
                        menuIsOpen={false}
                        placeholder={focused ? '' : placeholder}
                        className={classNames('Input', className, {Input__focus: showLegend})}
                        value={value}
                        onChange={onChange as any} // types are not working correctly for multiselect
                        styles={{...baseStyles, ...styles}}
                        {...otherProps}
                    />
                </div>
                {addon}
            </fieldset>
        </div>
    );
};

export default MultiInput;
