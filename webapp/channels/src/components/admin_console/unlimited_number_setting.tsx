// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import type {ChangeEvent} from 'react';

import Setting from 'components/widgets/settings/setting';

import SetByEnv from './set_by_env';

type Props = {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    value: number;
    onChange: (id: string, value: number) => void;
    disabled?: boolean;
    setByEnv?: boolean;
    placeholder?: string;
    defaultValue?: number;
    unlimitedLabel?: string;
}

/**
 * UnlimitedNumberSetting combines a number input with an "Unlimited" checkbox.
 * When "Unlimited" is checked, the number input is disabled and the value is set to -1.
 * This provides a clean UX for settings that use -1 as a sentinel value for "unlimited".
 */
const UnlimitedNumberSetting: React.FC<Props> = ({
    id,
    label,
    helpText,
    value,
    onChange,
    disabled = false,
    setByEnv = false,
    placeholder = '',
    defaultValue = 1,
    unlimitedLabel = 'Unlimited',
}: Props) => {
    const isDisabled = disabled || setByEnv;
    const isUnlimited = value === -1;

    const [inputValue, setInputValue] = useState<string>(isUnlimited ? '' : String(value));

    useEffect(() => {
        setInputValue(isUnlimited ? '' : String(value));
    }, [value, isUnlimited]);

    const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        if (checked) {
            onChange(id, -1);
        } else {
            onChange(id, defaultValue);
        }
    };

    const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);

        const parsed = parseInt(newValue, 10);
        if (!isNaN(parsed) && parsed >= 1) {
            onChange(id, parsed);
        }
    };

    return (
        <Setting
            label={label}
            labelClassName='col-sm-4'
            inputClassName='col-sm-8'
            helpText={helpText}
            inputId={id}
            footer={setByEnv ? <SetByEnv/> : undefined}
        >
            <div className='unlimited-number-setting'>
                <input
                    id={id}
                    data-testid={`${id}number`}
                    type='number'
                    className='form-control'
                    style={{display: 'inline-block', width: 'auto', marginRight: '16px'}}
                    value={inputValue}
                    onChange={handleNumberChange}
                    disabled={isDisabled || isUnlimited}
                    placeholder={isUnlimited ? unlimitedLabel : placeholder}
                    min={1}
                />
                <label
                    className='unlimited-checkbox-label'
                    style={{display: 'inline-flex', alignItems: 'center', cursor: isDisabled ? 'not-allowed' : 'pointer'}}
                >
                    <input
                        data-testid={`${id}checkbox`}
                        type='checkbox'
                        checked={isUnlimited}
                        onChange={handleCheckboxChange}
                        disabled={isDisabled}
                        style={{marginRight: '8px'}}
                    />
                    {unlimitedLabel}
                </label>
            </div>
        </Setting>
    );
};

export default UnlimitedNumberSetting;
