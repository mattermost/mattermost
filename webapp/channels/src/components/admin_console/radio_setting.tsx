// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import Setting from './setting';

import './radio_setting.scss';

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

    const isDisabled = disabled || setByEnv;

    const options = values.map(({value: optionValue, text}) => {
        const labelClasses = classNames('RadioSetting__label', {
            'RadioSetting__label--disabled': isDisabled,
        });

        return (
            <label
                key={optionValue}
                className={labelClasses}
            >
                <input
                    type='radio'
                    className='RadioSetting__input'
                    value={optionValue}
                    name={id}
                    checked={optionValue === value}
                    onChange={handleChange}
                    disabled={isDisabled}
                />
                <span className='RadioSetting__text'>
                    {text}
                </span>
            </label>
        );
    });

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

export default React.memo(RadioSetting);
