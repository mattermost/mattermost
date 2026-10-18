// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';

import Input from 'components/widgets/inputs/input/input';

import Setting from './setting';

const INPUT_TYPES = ['text', 'textarea', 'number', 'email', 'tel', 'url', 'password'] as const;
export type InputTypes = typeof INPUT_TYPES[number];

export type Props = {
    id: string;
    label: ReactNode;
    labelClassName?: string;
    placeholder?: string;
    value: string | number | string[];
    helpText?: ReactNode;
    footer?: ReactNode;
    inputClassName?: string;
    maxLength?: number;
    resizable?: boolean;
    onChange(id: string, value: any): void;
    disabled?: boolean;

    // This is a custom prop that is not part of the HTML input element type
    type?: InputTypes;
    autoFocus?: boolean;
    multiple?: boolean;
};

/**
 * Extract a floating-label string/descriptor from TextSetting's ReactNode label.
 * Supports plain strings and FormattedMessage-shaped elements. Complex nodes
 * (e.g. apps form labels with required markers) return undefined so the
 * Setting column label is kept instead.
 */
function toFloatingLabel(label: ReactNode): string | MessageDescriptor | undefined {
    if (typeof label === 'string') {
        return label;
    }
    if (typeof label === 'number') {
        return String(label);
    }
    if (!React.isValidElement(label)) {
        return undefined;
    }

    const props = label.props as Partial<MessageDescriptor> & {values?: Record<string, React.ReactNode>};
    if (typeof props.id === 'string' && props.defaultMessage !== undefined) {
        return {
            id: props.id,
            defaultMessage: props.defaultMessage,
            values: props.values,
        };
    }

    return undefined;
}

function TextSetting(props: Props) {
    const {labelClassName = '', inputClassName = '', maxLength = -1, resizable = true, type = 'text'} = props;

    function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        if (props.type === 'number') {
            props.onChange(props.id, parseInt(event.target.value, 10));
        } else if (props.type === 'text' && props.multiple) {
            if (event.target.value === '') {
                props.onChange(props.id, []);
            } else {
                props.onChange(props.id, event.target.value.split(','));
            }
        } else {
            props.onChange(props.id, event.target.value);
        }
    }

    const useCompassField = type === 'text' || type === 'textarea';
    const floatingLabel = useCompassField ? toFloatingLabel(props.label) : undefined;

    // Avoid duplicating the Setting column label when Compass owns the floating label.
    const settingLabel = floatingLabel !== undefined ? undefined : props.label;

    let input = null;
    if (useCompassField) {
        // a lot of our e2e test rely on 'input' being in the test id if it's a text/textarea input
        const testId = `${props.id}input`;
        const inputValue = Array.isArray(props.value) ? props.value.join(',') : props.value;
        const resolvedMaxLength = maxLength >= 0 ? maxLength : undefined;

        input = (
            <Input
                id={props.id}
                name={props.id}
                data-testid={testId}
                type={type}
                value={inputValue}
                label={floatingLabel}
                placeholder={props.placeholder}
                maxLength={resolvedMaxLength}
                disabled={props.disabled}
                autoFocus={props.autoFocus}
                onChange={handleChange}
                rows={type === 'textarea' ? 5 : undefined}
                useLegend={floatingLabel !== undefined}
                dir='auto'
                style={type === 'textarea' && resizable === false ? {resize: 'none'} : undefined}
            />
        );
    } else {
        const inputType = INPUT_TYPES.includes(type) ? type : 'text';

        // a lot of our e2e test rely on 'input' being in the test id if it's a text/textarea input
        const testId = inputType === 'text' ? `${props.id}input` : `${props.id}${inputType}`;

        input = (
            <input
                id={props.id}
                data-testid={testId}
                className='form-control'
                autoFocus={props.autoFocus}
                type={inputType}
                placeholder={props.placeholder}
                value={props.value}
                maxLength={maxLength}
                onChange={handleChange}
                disabled={props.disabled}
            />
        );
    }

    return (
        <Setting
            label={settingLabel}
            labelClassName={labelClassName}
            inputClassName={inputClassName}
            helpText={props.helpText}
            inputId={props.id}
            footer={props.footer}
        >
            {input}
        </Setting>
    );
}

export default TextSetting;
