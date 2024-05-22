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
}

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
}: Props) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.checked);
    };

    return (
        <Setting
            label={label}
            labelClassName={labelClassName}
            inputClassName={inputClassName}
            helpText={helpText}
            inputId={id}
        >
            <div className='checkbox'>
                <label>
                    <input
                        id={id}
                        disabled={disabled}
                        autoFocus={autoFocus}
                        type='checkbox'
                        checked={value}
                        onChange={handleChange}
                    />
                    <span>{placeholder}</span>
                </label>
            </div>
        </Setting>
    );
};

export default React.memo(BoolSetting);
