// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {CloseCircleIcon} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

import {ItemStatus} from 'utils/constants';
import {formatAsString} from 'utils/i18n';

import './input.scss';

export enum SIZE {
    MEDIUM = 'medium',
    LARGE = 'large',
}

export type CustomMessageInputType = {type?: 'info' | 'error' | 'warning' | 'success'; value: React.ReactNode} | null;

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'placeholder'> {
    required?: boolean;
    hasError?: boolean;
    addon?: React.ReactElement;
    textPrefix?: string;
    inputPrefix?: JSX.Element;
    inputSuffix?: JSX.Element;
    label?: string | MessageDescriptor;
    placeholder?: MessageDescriptor | string;
    containerClassName?: string;
    wrapperClassName?: string;
    inputClassName?: string;
    limit?: number;
    useLegend?: boolean;
    customMessage?: CustomMessageInputType;
    inputSize?: SIZE;
    clearable?: boolean;
    clearableTooltipText?: string;
    onClear?: () => void;
}

const Input = React.forwardRef((
    {
        name,
        value,
        label,
        placeholder,
        useLegend = true,
        className,
        hasError,
        required,
        addon,
        textPrefix,
        inputPrefix,
        inputSuffix,
        containerClassName,
        wrapperClassName,
        inputClassName,
        limit,
        customMessage,
        maxLength,
        inputSize = SIZE.MEDIUM,
        disabled,
        clearable,
        clearableTooltipText,
        onFocus,
        onBlur,
        onChange,
        onClear,
        ...otherProps
    }: InputProps,
    ref?: React.Ref<HTMLInputElement | HTMLTextAreaElement>,
) => {
    const {formatMessage} = useIntl();

    const [focused, setFocused] = useState(false);
    const [customInputLabel, setCustomInputLabel] = useState<CustomMessageInputType>(null);

    useEffect(() => {
        if (customMessage === undefined || customMessage === null) {
            if (customInputLabel !== null) {
                // edge-use case: a consumer of this component may have its input updated
                // from more than one place, such as by a network fetching data after load
                // in that case, we need to remove the error according to the response
                setCustomInputLabel(customMessage || null);
            }
            return;
        }

        if (customMessage !== undefined && customMessage !== null && Boolean(customMessage.value)) {
            setCustomInputLabel(customMessage);
        }
    }, [customMessage]);

    const handleOnFocus = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFocused(true);

        if (onFocus) {
            onFocus(event);
        }
    };

    const handleOnBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFocused(false);
        validateInput();

        if (onBlur) {
            onBlur(event);
        }
    };

    const handleOnChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setCustomInputLabel(null);

        if (onChange) {
            onChange(event);
        }
    };

    const handleOnClear = () => {
        if (onClear) {
            onClear();
        }
    };

    const validateInput = () => {
        if (!required || (value !== null && value !== '')) {
            return;
        }
        const validationErrorMsg = formatMessage({id: 'widget.input.required', defaultMessage: 'This field is required'});
        setCustomInputLabel({type: ItemStatus.ERROR, value: validationErrorMsg});
    };

    const showLegend = Boolean(focused || value);
    const error = customInputLabel?.type === 'error';
    const limitExceeded = limit && value && !Array.isArray(value) ? value.toString().length - limit : 0;

    const clearButton = value && clearable ? (
        <div
            className='Input__clear'
            onMouseDown={handleOnClear}
            onTouchEnd={handleOnClear}
        >
            <WithTooltip
                title={clearableTooltipText || formatMessage({id: 'widget.input.clear', defaultMessage: 'Clear'})}
            >
                <CloseCircleIcon size={18}/>
            </WithTooltip>
        </div>
    ) : null;

    const generateInput = () => {
        const placeholderValue = formatAsString(formatMessage, focused ? (label && placeholder) || label : label || placeholder);
        const ariaLabel = formatAsString(formatMessage, label || placeholder);

        if (otherProps.type === 'textarea') {
            return (
                <textarea
                    ref={ref as React.RefObject<HTMLTextAreaElement>}
                    id={`input_${name || ''}`}
                    className={classNames('Input form-control', inputSize, inputClassName, {Input__focus: showLegend})}
                    value={value}
                    placeholder={placeholderValue}
                    aria-label={ariaLabel}
                    rows={3}
                    name={name}
                    disabled={disabled}
                    {...otherProps}
                    maxLength={limit ? undefined : maxLength}
                    onFocus={handleOnFocus}
                    onBlur={handleOnBlur}
                    onChange={handleOnChange}
                />);
        }
        return (
            <input
                ref={ref as React.RefObject<HTMLInputElement>}
                id={`input_${name || ''}`}
                className={classNames('Input form-control', inputSize, inputClassName, {Input__focus: showLegend})}
                value={value}
                placeholder={placeholderValue}
                aria-label={ariaLabel}
                name={name}
                disabled={disabled}
                {...otherProps}
                maxLength={limit ? undefined : maxLength}
                onFocus={handleOnFocus}
                onBlur={handleOnBlur}
                onChange={handleOnChange}
            />
        );
    };

    return (
        <div className={classNames('Input_container', containerClassName, {disabled})}>
            <fieldset
                className={classNames('Input_fieldset', className, {
                    Input_fieldset___error: error || hasError || limitExceeded > 0,
                    Input_fieldset___legend: showLegend,
                })}
            >
                {useLegend && (
                    <legend className={classNames('Input_legend', {Input_legend___focus: showLegend})}>
                        {showLegend ? formatAsString(formatMessage, label || placeholder) : null}
                    </legend>
                )}
                <div className={classNames('Input_wrapper', wrapperClassName)}>
                    {inputPrefix}
                    {textPrefix && <span>{textPrefix}</span>}
                    {generateInput()}
                    {limitExceeded > 0 && (
                        <span className='Input_limit-exceeded'>
                            {'-'}{limitExceeded}
                        </span>
                    )}
                    {inputSuffix}
                    {clearButton}
                </div>
                {addon}
            </fieldset>
            {customInputLabel && (
                <div className={`Input___customMessage Input___${customInputLabel.type}`}>
                    {customInputLabel.type && (
                        <i
                            className={classNames(`icon ${customInputLabel.type}`, {
                                'icon-alert-outline': customInputLabel.type === ItemStatus.WARNING,
                                'icon-alert-circle-outline': customInputLabel.type === ItemStatus.ERROR,
                                'icon-information-outline': customInputLabel.type === ItemStatus.INFO,
                                'icon-check': customInputLabel.type === ItemStatus.SUCCESS,
                            })}
                        />)}
                    <span>{customInputLabel.value}</span>
                </div>
            )}
        </div>
    );
});

export default Input;
