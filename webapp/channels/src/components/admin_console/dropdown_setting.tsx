// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

type Props = {
    id: string;
    values: Array<{ text: string; value: string }>;
    label: React.ReactNode;
    value: string;
    onChange(id: string, value: any): void;
    disabled?: boolean;
    setByEnv: boolean;
    helpText?: React.ReactNode;
}
const DropdownSetting = ({
    id,
    values,
    label,
    value,
    onChange,
    disabled = false,
    setByEnv,
    helpText,
}: Props) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(id, e.target.value);
    };

    const options = [];
    for (const {value, text} of values) {
        options.push(
            <option
                value={value}
                key={value}
            >
                {text}
            </option>,
        );
    }

    return (
        <Setting
            label={label}
            inputId={id}
            helpText={helpText}
            setByEnv={setByEnv}
        >
            <select
                data-testid={id + 'dropdown'}
                className='form-control'
                id={id}
                value={value}
                onChange={handleChange}
                disabled={disabled || setByEnv}
            >
                {options}
            </select>
        </Setting>
    );
};

export default DropdownSetting;
