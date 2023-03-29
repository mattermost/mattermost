// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

interface Props {
    id: string;
    label: React.ReactNode;
    values: Array<{ text: string; value: string }>;
    value: string;
    setByEnv: boolean;
    disabled?: boolean;
    helpText?: React.ReactNode;
    onChange(id: string, value: any): void;
}

const RadioSetting = ({
    id,
    label,
    values,
    value,
    setByEnv,
    disabled = false,
    helpText,
    onChange,
}: Props) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.value);
    };
    const options = [];
    for (const {value: v, text} of values) {
        options.push(
            <div
                className='radio'
                key={value}
            >
                <label>
                    <input
                        type='radio'
                        value={value}
                        name={id}
                        checked={value === v}
                        onChange={handleChange}
                        disabled={disabled || setByEnv}
                    />
                    {text}
                </label>
            </div>,
        );
    }

    return (
        <Setting
            label={label}
            inputId={id}
            helpText={helpText}
            setByEnv={setByEnv}
        >
            {options}
        </Setting>
    );
};

export default RadioSetting;
