// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, ReactNode} from 'react';

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
    min?: number | string;
    max?: number | string;
    step?: number | string;
};

function TextSetting(props: Props) {
    const {labelClassName = '', inputClassName = '', maxLength = -1, resizable = true, type = 'text'} = props;

    function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        if (props.type === 'number') {
            // Empty / intermediate values ("", "-") parse to NaN; keep prior
            // master behavior of forwarding parseInt result (including NaN).
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

    // All supported InputTypes go through the Compass Input adapter. Password
    // uses TextInput (type=password), not PasswordInput — System Console API
    // keys stay masked without a show/hide toggle (matches master).
    // e2e: text/textarea → `${id}input`; password/number/… → `${id}${type}`
    const testId = (type === 'text' || type === 'textarea') ? `${props.id}input` : `${props.id}${type}`;
    const inputValue = Array.isArray(props.value) ? props.value.join(',') : props.value;
    const resolvedMaxLength = maxLength >= 0 ? maxLength : undefined;

    const input = (
        <Input
            id={props.id}
            name={props.id}
            data-testid={testId}
            type={type}
            value={inputValue}
            placeholder={props.placeholder}
            maxLength={resolvedMaxLength}
            min={props.min}
            max={props.max}
            step={props.step}
            disabled={props.disabled}
            autoFocus={props.autoFocus}
            onChange={handleChange}
            rows={type === 'textarea' ? 5 : undefined}
            useLegend={false}

            // Setting's left-column <label htmlFor> owns the accessible name.
            // Override the adapter's useLegend=false fallback that would set
            // aria-label from the placeholder and steal naming from that label.
            aria-label={undefined}
            dir='auto'
            style={type === 'textarea' && resizable === false ? {resize: 'none'} : undefined}
        />
    );

    return (
        <Setting
            label={props.label}
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
