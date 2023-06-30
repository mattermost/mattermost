// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent} from 'react';

import Setting from './setting';

export const INPUT_TYPES = ['input', 'textarea', 'number', 'email', 'tel', 'url', 'password'] as const;

export type InputTypes = typeof INPUT_TYPES[number];

export type Props = {
    id: string;
    label: React.ReactNode;
    labelClassName?: string;
    placeholder?: string;
    helpText?: React.ReactNode;
    footer?: React.ReactNode;
    value: string | number;
    inputClassName?: string;
    maxLength?: number;
    resizable?: boolean;
    onChange(id: string, value: string | number | boolean): void;
    disabled?: boolean;
    type?: InputTypes;
    autoFocus?: boolean;
}

function TextSetting(props: Props) {
    const {labelClassName = '', inputClassName = '', maxLength = -1, resizable = true, type = 'input'} = props;

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
                autoFocus={props.autoFocus}
                data-testid={props.id + 'input'}
                id={props.id}
                dir='auto'
                style={resizable === false ? {resize: 'none'} : undefined}
                className='form-control'
                rows={5}
                placeholder={props.placeholder}
                value={props.value}
                maxLength={maxLength}
                onChange={handleChange}
                disabled={props.disabled}
            />
        );
    } else {
        input = (
            <input
                autoFocus={props.autoFocus}
                data-testid={props.id + type}
                id={props.id}
                className='form-control'
                type={type && INPUT_TYPES.includes(type) ? type : 'input'}
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
