// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

type Props = {
    id: string;
    values: Array<{ text: string; value: string }>;
    label: React.ReactNode;
    value: string;
    onChange(id: string, value: string | boolean): void;
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
                {values.map(({value: v, text}) => {
                    return (
                        <option
                            value={v}
                            key={value}
                        >
                            {text}
                        </option>
                    );
                })}
            </select>
        </Setting>
    );
};

export default DropdownSetting;
