// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    value: boolean;
    onChange: (id: string, foo: boolean) => void;
    trueText?: React.ReactNode;
    falseText?: React.ReactNode;
    disabled: boolean | undefined;
    setByEnv: boolean;
    disabledText?: React.ReactNode;
    helpText: React.ReactNode;
}

export const BooleanSetting = ({
    id,
    label,
    value,
    onChange,
    trueText = (
        <FormattedMessage
            id='admin.true'
            defaultMessage='true'
        />
    ),
    falseText = (
        <FormattedMessage
            id='admin.false'
            defaultMessage='false'
        />
    ),
    disabled = false,
    setByEnv,
    disabledText,
    helpText,
}: Props) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.value === 'true');
    };

    let renderedHelpText = helpText;
    if (disabled && disabledText) {
        renderedHelpText = (
            <div>
                <span className='admin-console__disabled-text'>
                    {disabledText}
                </span>
                {helpText}
            </div>
        );
    }

    return (
        <Setting
            inputId={id}
            label={label}
            helpText={renderedHelpText}
            setByEnv={setByEnv}
        >
            <a id={id}/>
            <label className='radio-inline'>
                <input
                    data-testid={id + 'true'}
                    type='radio'
                    value='true'
                    id={Utils.createSafeId(id) + 'true'}
                    name={id}
                    checked={value}
                    onChange={handleChange}
                    disabled={disabled || setByEnv}
                />
                {trueText}
            </label>
            <label className='radio-inline'>
                <input
                    data-testid={id + 'false'}
                    type='radio'
                    value='false'
                    id={Utils.createSafeId(id) + 'false'}
                    name={id}
                    checked={!value}
                    onChange={handleChange}
                    disabled={disabled || setByEnv}
                />
                {falseText}
            </label>
        </Setting>
    );
};

export default BooleanSetting;
