// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent} from 'react';
import React from 'react';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    labelClassName?: string;
    helpText?: React.ReactNode;
    placeholder: string;
    value: boolean;
    disabled?: boolean;
    inputClassName?: string;
    onChange(name: string, value: any): void; // value is any since onChange is a common func for inputs and checkboxes
    autoFocus?: boolean;
    labelPosition?: 'before' | 'after';
};

const BoolSetting = ({
    id,
    label,
    labelClassName = '',
    helpText,
    placeholder,
    value,
    disabled,
    inputClassName = '',
    onChange,
    autoFocus,
    labelPosition = 'after',
}: Props) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.checked);
    };

    return (
        <Setting
            label={label}
            labelClassName={labelClassName}
            inputClassName={`inline-choice-setting ${inputClassName}`.trim()}
            helpText={helpText}
            inputId={id}
        >
            <div className='checkbox'>
                <label>
                    {labelPosition === 'before' && (
                        <span className='inline-choice-setting__text'>{placeholder}</span>
                    )}
                    <input
                        id={id}
                        disabled={disabled}
                        autoFocus={autoFocus}
                        type='checkbox'
                        checked={value}
                        onChange={handleChange}
                    />
                    {labelPosition === 'after' && (
                        <span className='inline-choice-setting__text'>{placeholder}</span>
                    )}
                </label>
            </div>
        </Setting>
    );
};

export default React.memo(BoolSetting);
