// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';
import ReactSelect, {components as rsComponents} from 'react-select';
import type {
    OptionProps,
    Props as ReactSelectProps,
    SingleValueProps,
    StylesConfig,
} from 'react-select';

import {ItemStatus} from 'utils/constants';
import {formatAsString} from 'utils/i18n';

import type {CustomMessageInputType} from './input/input';

import './labeled_select.scss';

export type LabeledSelectOption<T extends string = string> = {
    label: string;
    value: T;
    icon?: React.ReactNode;
};

type LabeledSelectValue<T extends string> =
    | LabeledSelectOption<T>
    | Array<LabeledSelectOption<T>>
    | null;

export type LabeledSelectProps<T extends string = string> = {
    inputId: string;
    label?: string | MessageDescriptor;
    placeholder?: string | MessageDescriptor;
    value: LabeledSelectValue<T>;
    options: Array<LabeledSelectOption<T>>;
    onChange: (next: LabeledSelectValue<T>) => void;
    isMulti?: boolean;
    isSearchable?: boolean;
    hasError?: boolean;
    customMessage?: CustomMessageInputType;
    disabled?: boolean;
    required?: boolean;

    // Forwarded to react-select for Slice 7's component overrides + style tweaks.
    // Anything supplied here MERGES with our defaults (caller overrides win).
    components?: ReactSelectProps<LabeledSelectOption<T>, boolean>['components'];
    styles?: StylesConfig<LabeledSelectOption<T>, boolean>;

    className?: string;
    'aria-label'?: string;
};

const baseStyles: StylesConfig<LabeledSelectOption, boolean> = {
    control: (provided) => ({
        ...provided,
        border: 'none',
        boxShadow: 'none',
        background: 'transparent',
        minHeight: '32px',
        cursor: 'pointer',
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '0 2px',
    }),
    indicatorSeparator: (provided) => ({
        ...provided,
        display: 'none',
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 100,
    }),
};

function DefaultOption<T extends string>(props: OptionProps<LabeledSelectOption<T>, boolean>) {
    const {data} = props;
    return (
        <rsComponents.Option {...props}>
            <span className='LabeledSelect__option-row'>
                {data.icon ? (
                    <span className='LabeledSelect__option-icon'>{data.icon}</span>
                ) : null}
                <span className='LabeledSelect__option-label'>{data.label}</span>
            </span>
        </rsComponents.Option>
    );
}

function DefaultSingleValue<T extends string>(props: SingleValueProps<LabeledSelectOption<T>, boolean>) {
    const {data} = props;
    return (
        <rsComponents.SingleValue {...props}>
            <span className='LabeledSelect__single-value-row'>
                {data.icon ? (
                    <span className='LabeledSelect__option-icon'>{data.icon}</span>
                ) : null}
                <span className='LabeledSelect__option-label'>{data.label}</span>
            </span>
        </rsComponents.SingleValue>
    );
}

const defaultComponents = {
    Option: DefaultOption,
    SingleValue: DefaultSingleValue,
    IndicatorSeparator: () => null,
} as ReactSelectProps<LabeledSelectOption, boolean>['components'];

function hasValue<T extends string>(value: LabeledSelectValue<T>): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return true;
}

function LabeledSelect<T extends string = string>(props: LabeledSelectProps<T>) {
    const {
        inputId,
        label,
        placeholder,
        value,
        options,
        onChange,
        isMulti,
        isSearchable = true,
        hasError,
        customMessage,
        disabled,
        required,
        components: callerComponents,
        styles: callerStyles,
        className,
        'aria-label': ariaLabel,
    } = props;

    const {formatMessage} = useIntl();
    const [focused, setFocused] = useState(false);

    const showLegend = focused || hasValue(value);
    const isError = Boolean(hasError) || customMessage?.type === ItemStatus.ERROR;
    const isWarning = customMessage?.type === ItemStatus.WARNING;

    const legendText = formatAsString(formatMessage, label || placeholder);
    const placeholderText = formatAsString(formatMessage, placeholder || label);
    const resolvedAriaLabel = ariaLabel ?? formatAsString(formatMessage, label || placeholder);
    const errorId = `error_${inputId}`;

    // Merge: caller overrides any default component. Spread order = caller wins.
    const mergedComponents = {
        ...(defaultComponents as object),
        ...(callerComponents || {}),
    } as ReactSelectProps<LabeledSelectOption<T>, boolean>['components'];

    return (
        <div className={classNames('LabeledSelect Input_container', className, {disabled})}>
            <div
                className={classNames('Input_fieldset', {
                    Input_fieldset___error: isError,
                    Input_fieldset___legend: showLegend,
                })}
            >
                {legendText !== undefined && (
                    <label
                        htmlFor={inputId}
                        className={classNames('Input_legend', {Input_legend___focus: showLegend})}
                    >
                        {showLegend ? legendText : null}
                    </label>
                )}
                <div
                    className='Input_wrapper'
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                >
                    <ReactSelect<LabeledSelectOption<T>, boolean>
                        inputId={inputId}
                        classNamePrefix='LabeledSelect'
                        className='LabeledSelect__control-wrapper'
                        aria-label={resolvedAriaLabel}
                        aria-invalid={isError || undefined}
                        aria-describedby={customMessage ? errorId : undefined}
                        aria-required={required || undefined}
                        isDisabled={disabled}
                        isMulti={isMulti as any}
                        isSearchable={isSearchable}
                        options={options}
                        value={value as any}
                        onChange={(next) => onChange(next as LabeledSelectValue<T>)}
                        placeholder={focused ? '' : placeholderText}
                        components={mergedComponents}
                        styles={{...(baseStyles as unknown as StylesConfig<LabeledSelectOption<T>, boolean>), ...(callerStyles || {})}}
                    />
                </div>
            </div>
            {customMessage && (
                <div
                    className={`Input___customMessage Input___${customMessage.type || 'error'}`}
                    id={errorId}
                    role={isError || isWarning ? 'alert' : undefined}
                >
                    <i
                        className={classNames(`icon ${customMessage.type || 'error'}`, {
                            'icon-alert-outline': (customMessage.type || 'error') === ItemStatus.WARNING,
                            'icon-alert-circle-outline': (customMessage.type || 'error') === ItemStatus.ERROR,
                            'icon-information-outline': (customMessage.type || 'error') === ItemStatus.INFO,
                            'icon-check': (customMessage.type || 'error') === ItemStatus.SUCCESS,
                        })}
                        role='img'
                        aria-hidden={true}
                    />
                    <span>{customMessage.value}</span>
                </div>
            )}
        </div>
    );
}

export default LabeledSelect;
