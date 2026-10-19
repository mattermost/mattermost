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
};

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

    // Compass TextInput/TextArea for chrome only — keep the classic Setting
    // left-column label (no floating legend). Account Settings and other
    // call sites that want floating labels use Input with useLegend default.
    const useCompassField = type === 'text' || type === 'textarea';

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
                placeholder={props.placeholder}
                maxLength={resolvedMaxLength}
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
