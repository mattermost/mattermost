// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import './style.scss';

export type RadioSetting = { text: string; value: string };

interface Props {
    id: string;
    values: RadioSetting[];
    value: string;
    disabled?: boolean;
    onChange(id: string, value: string): void;
    orientation?: 'horizontal' | 'vertical';
}
export default function RadioSettingsGroup({
    id,
    values,
    value,
    disabled = false,
    onChange,
    orientation = 'vertical',
}: Props) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.value);
    };

    const options = values.map(({value: optionValue, text}) => (
        <div
            className='RadioSettingGroup_option'
            key={optionValue}
        >
            <label className='RadioSettingGroup_option_label horizontal'>
                <input
                    type='radio'
                    value={optionValue}
                    name={id}
                    checked={optionValue === value}
                    onChange={handleChange}
                    disabled={disabled}
                />
                <span>
                    {text}
                </span>
            </label>
        </div>
    ));

    return (
        <div className={`RadioSettingGroup ${orientation}`}>
            {options}
        </div>
    );
}
