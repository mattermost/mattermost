// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import RadioInput from 'widgets/radio_setting/radio_input';

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

    const options = values.map(({value: optionValue, text}) => (
        <RadioInput
            key={optionValue}
            id={optionValue}
            title={text}
            name={id}
            value={optionValue}
            checked={optionValue === value}
            handleChange={handleChange}
            disabled={disabled || setByEnv}
        />
    ));

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
