// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

import type {ChangeEvent, ReactNode} from 'react';

const INPUT_TYPES = ['text', 'textarea', 'number', 'email', 'tel', 'url', 'password'] as const;
export type InputTypes = typeof INPUT_TYPES[number];

export type Props = {
    id: string;
    label: ReactNode;
    labelClassName?: string;
    placeholder?: string;
    helpText?: ReactNode;
    footer?: ReactNode;
    value: string | number;
    inputClassName?: string;
    maxLength?: number;
    resizable?: boolean;
    onChange(id: string, value: any): void;
    disabled?: boolean;

    // This is a custom prop that is not part of the HTML input element type
    type?: InputTypes;
    autoFocus?: boolean;
}

function TextSetting(props: Props) {
    const {labelClassName = '', inputClassName = '', maxLength = -1, resizable = true, type = 'text'} = props;

    function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        if (props.type === 'number') {
            props.onChange(props.id, parseInt(event.target.value, 10));
        } else {
            props.onChange(props.id, event.target.value);
        }
    }

    let input = null;
    if (type === 'textarea') {
        input = (
            <textarea
                id={props.id}
                data-testid={`${props.id}input`} // a lot of our e2e test rely on 'input' being in the test id if it's a text/textarea input
                className='form-control'
                autoFocus={props.autoFocus}
                dir='auto'
                rows={5}
                placeholder={props.placeholder}
                style={resizable === false ? {resize: 'none'} : undefined}
                value={props.value}
                maxLength={maxLength}
                onChange={handleChange}
                disabled={props.disabled}
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
