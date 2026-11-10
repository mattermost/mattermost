// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {Radio} from '@mattermost/compass-ui/components/radio';

import Setting from './setting';

import './radio_setting.scss';

interface Props {
    id: string;
    label: React.ReactNode;
    values: Array<{text: string; value: string}>;
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
        const radioClassName = classNames('RadioSetting__radio', {
            'RadioSetting__radio--disabled': isDisabled,
        });

        return (
            <Radio
                key={optionValue}
                className={radioClassName}
                name={id}
                value={optionValue}
                checked={optionValue === value}
                onChange={handleChange}
                disabled={isDisabled}
            >
                <span className='RadioSetting__text'>
                    {text}
                </span>
            </Radio>
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
