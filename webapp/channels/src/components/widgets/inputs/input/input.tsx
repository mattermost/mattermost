// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, type JSX} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import type {FieldMessageTone} from '@mattermost/compass-ui/components/field-message';
import {TextArea} from '@mattermost/compass-ui/components/text-area';
import type {TextAreaSize} from '@mattermost/compass-ui/components/text-area';
import {TextInput} from '@mattermost/compass-ui/components/text-input';
import type {TextInputSize} from '@mattermost/compass-ui/components/text-input';

import {ItemStatus} from 'utils/constants';
import {formatAsString} from 'utils/i18n';

import './input.scss';

export enum SIZE {
    SMALL = 'small',
    MEDIUM = 'medium',
    LARGE = 'large',
}

export type CustomMessageInputType = {type?: 'info' | 'error' | 'warning' | 'success'; value: React.ReactNode} | null;

const INPUT_SIZE_MAP: Record<SIZE, TextInputSize & TextAreaSize> = {
    [SIZE.SMALL]: 'small',
    [SIZE.MEDIUM]: 'medium',
    [SIZE.LARGE]: 'large',
};

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'placeholder' | 'size'> {
    required?: boolean;
    hasError?: boolean;

    /**
     * In-field trailing chrome (spinner, check). Prefer `trailingAction` for labeled
     * actions like Copy. Maps to Compass `trailingIcon`.
     */
    addon?: React.ReactElement<any>;

    /** @deprecated Unsupported by Compass; retained for a few legacy call sites. */
    textPrefix?: string;
    inputPrefix?: JSX.Element;
    inputSuffix?: JSX.Element;
    label?: string | MessageDescriptor;
    placeholder?: MessageDescriptor | string;
    containerClassName?: string;

    /** @deprecated Not supported on Compass fields; applied to the adapter root for CSS compat. */
    wrapperClassName?: string;

    /** @deprecated Prefer `className` on the adapter root. */
    inputClassName?: string;
    limit?: number;
    minLength?: number;
    useLegend?: boolean;
    customMessage?: CustomMessageInputType;
    inputSize?: SIZE;

    /**
     * When true with an effective max (`maxLength` or `limit`), shows Compass
     * "current / max" character count under the field.
     */
    showCharacterCount?: boolean;
    clearable?: boolean;

    /** @deprecated Compass clear has no tooltip; use `clearLabel` via clear button a11y only. */
    clearableTooltipText?: string;
    onClear?: () => void;
    rows?: number;
    validate?: (value: React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>['value']) => CustomMessageInputType | undefined;

    /**
     * Labeled action outside the field border (e.g. Copy). Maps to Compass `trailingAction`.
     */
    trailingAction?: React.ReactNode;
}

/**
 * @deprecated Temporary host adapter over Compass `TextInput` / `TextArea`.
 * Prefer importing those from `@mattermost/compass-ui` for new UI. Kept so existing
 * call sites that rely on `required` / `limit` / `minLength` / `validate` can migrate
 * incrementally. Do not add new call sites.
 */
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
        minLength,
        customMessage,
        maxLength,
        inputSize = SIZE.MEDIUM,
        showCharacterCount = false,
        disabled,
        clearable,
        clearableTooltipText,
        onFocus,
        onBlur,
        onChange,
        onClear,
        rows,
        validate,
        trailingAction,
        type: inputType,
        ...otherProps
    }: InputProps,
    ref?: React.Ref<HTMLInputElement | HTMLTextAreaElement>,
) => {
    const {formatMessage} = useIntl();

    // Compass clear uses clearLabel only; keep the prop for call-site compat.
    const clearLabelFallback = clearableTooltipText;

    const [focused, setFocused] = useState(false);
    const [customInputLabel, setCustomInputLabel] = useState<CustomMessageInputType>(null);

    const inputId = `input_${name || ''}`;

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

    // Re-validate input when value changes (e.g. when a parent component sets a new value,not just when the user types)
    useEffect(() => {
        // Only run validation if we're not focused (to avoid validating during typing)
        // and if there is currently an error displayed
        if (!focused && customInputLabel?.type === 'error') {
            // Clear error state when value changes
            setCustomInputLabel(null);

            // Re-run validation to check if the new value is valid
            if (value !== undefined && value !== null && value !== '') {
                validateInput();
            }
        }
    }, [value]); // Only run when value changes

    const handleOnFocus = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFocused(true);

        if (onFocus) {
            onFocus(event);
        }
    };

    const handleOnBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFocused(false);

        if (event.relatedTarget && (event.relatedTarget as HTMLElement).click) {
            const target = event.relatedTarget as HTMLElement;
            const listener = () => {
                validateInput();
                if (target) {
                    target.removeEventListener('click', listener);
                }
            };
            target.addEventListener('click', listener);
        } else {
            validateInput();
        }

        if (onBlur) {
            onBlur(event);
        }
    };

    const handleOnChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // Clear custom messages when user types
        setCustomInputLabel(null);

        if (onChange) {
            onChange(event);
        }
    };

    const validateInput = () => {
        if (validate) {
            const validationError = validate(value);
            if (validationError) {
                setCustomInputLabel(validationError);
                return;
            }
        }

        // Only check for required field validation on blur
        // Length validation is handled through derived values in the render function
        if (required && (value === null || value === '')) {
            const validationErrorMsg = formatMessage({id: 'widget.input.required', defaultMessage: 'This field is required'});
            setCustomInputLabel({type: ItemStatus.ERROR, value: validationErrorMsg});
            return;
        }

        const limitExceeded = limit && value && !Array.isArray(value) ? value.toString().length - limit : 0;
        const minLengthNotMet = minLength && value !== undefined && !Array.isArray(value) ? minLength - value.toString().length : (minLength || 0);

        // Show min length error even when the input is empty (to match existing behavior in tests)
        // Generate derived error messages
        if (limitExceeded > 0) {
            setCustomInputLabel({
                type: ItemStatus.ERROR,
                value: formatMessage(
                    {id: 'widget.input.max_length', defaultMessage: 'Must be no more than {limit} characters'},
                    {limit},
                )});
        } else if (minLengthNotMet > 0) {
            setCustomInputLabel({
                type: ItemStatus.ERROR,
                value: formatMessage(
                    {id: 'widget.input.min_length', defaultMessage: 'Must be at least {minLength} characters'},
                    {minLength},
                ),
            });
        }
    };

    const isTextarea = inputType === 'textarea';
    const messageTone = (customInputLabel?.type || ItemStatus.ERROR) as FieldMessageTone;
    const message = customInputLabel?.value;
    const isInvalid = Boolean(hasError) || customInputLabel?.type === ItemStatus.ERROR;

    // Floating label may fall back to placeholder when no label is passed. In that
    // case omit the in-field placeholder so the same string is not shown twice.
    const floatingLabel = useLegend ? formatAsString(formatMessage, label || placeholder) : undefined;
    let compassPlaceholder: string | undefined;
    if (useLegend) {
        compassPlaceholder = label ? formatAsString(formatMessage, placeholder) : undefined;
    } else {
        // Classic left-column label (TextSetting / admin forms): keep the caller's
        // placeholder on the control even while focused. The old focused branch
        // cleared it when label was unset, which broke Apps Form / dialog e2e.
        compassPlaceholder = formatAsString(formatMessage, placeholder);
    }
    const ariaLabel = useLegend ? undefined : formatAsString(formatMessage, label || placeholder);
    const clearLabel = clearLabelFallback || formatMessage({id: 'widget.input.clear', defaultMessage: 'Clear'});

    // Omit `value` when unset so defaultValue can keep the field uncontrolled.
    // Passing value={undefined} still makes React treat the input as controlled
    // and re-assert an empty string on render, which wipes IME composition (MM-70289).
    const valueProps = value === undefined || value === null ? {} : {value};

    const rootClassName = classNames('Input', className, inputClassName, wrapperClassName);
    const size = INPUT_SIZE_MAP[inputSize];

    // Prefer explicit trailingAction; map legacy in-field addon to trailingIcon.
    const resolvedTrailingAction = trailingAction;
    const trailingIcon = inputSuffix || addon || undefined;

    // Character count needs Compass maxLength. When `limit` is used without a
    // counter, omit native maxLength so callers can type past and show errors.
    const effectiveMaxLength = maxLength ?? limit;
    let resolvedMaxLength: number | undefined;
    if (showCharacterCount) {
        resolvedMaxLength = effectiveMaxLength;
    } else if (limit) {
        resolvedMaxLength = undefined;
    } else {
        resolvedMaxLength = maxLength;
    }

    const sharedFieldProps = {
        id: inputId,
        className: rootClassName,
        size,
        invalid: isInvalid,
        label: floatingLabel,
        placeholder: compassPlaceholder,
        name,
        disabled,
        'aria-label': ariaLabel,
        'data-testid': 'input-wrapper',
        message,
        messageTone: message ? messageTone : undefined,
        showCharacterCount: Boolean(showCharacterCount && effectiveMaxLength),
        ...valueProps,
        ...otherProps,
        maxLength: resolvedMaxLength,
        onFocus: handleOnFocus,
        onBlur: handleOnBlur,
        onChange: handleOnChange,
    };

    let field: React.ReactNode;
    if (isTextarea) {
        field = (
            <TextArea
                ref={ref as React.Ref<HTMLTextAreaElement>}
                {...sharedFieldProps}
                rows={rows || 3}
            />
        );
    } else {
        field = (
            <TextInput
                ref={ref as React.Ref<HTMLInputElement>}
                {...sharedFieldProps}
                type={inputType}
                leadingIcon={inputPrefix}
                trailingIcon={trailingIcon}
                trailingAction={resolvedTrailingAction}
                clearable={clearable}
                clearLabel={clearLabel}
                onClear={onClear}
            />
        );
    }

    return (
        <div className={classNames('Input_container', containerClassName, {disabled})}>
            {textPrefix && <span className='Input_textPrefix'>{textPrefix}</span>}
            {field}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
