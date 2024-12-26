// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import * as Utils from 'utils/utils';

import SettingSet from './setting_set';

const Label = styled.label<{isDisabled: boolean}>`
    display: inline-flex;
    opacity: ${({isDisabled}) => (isDisabled ? 0.5 : 1)};
    margin-top: 8px;
    margin-right: 24px;
    width: fit-content;
    flex-direction: row;
    align-items: center;
    margin-bottom: 0;
    cursor: pointer;
    font-size: 14px;
    font-weight: 400;
    gap: 8px;
    line-height: 20px;

    span {
        cursor: pointer;
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
    }

    input {
        display: grid;
        width: 1.6rem;
        height: 1.6rem;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
        border-radius: 50%;
        margin: 0;
        -webkit-appearance: none;
        appearance: none;
        background-color: white;
        color: rgba(var(--center-channel-color-rgb), 0.24);
        cursor: pointer;
        font: inherit;
        place-content: center;

        &:checked {
            border-color: var(--denim-button-bg);
        }

        &:checked::before {
            transform: scale(1);
        }

        &::before {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--denim-button-bg);
            content: "";
            transform: scale(0);
            transform-origin: center center;
            transition: 200ms transform ease-in-out;
        }
    }
`;

type Props = {
    id: string;
    label: React.ReactNode;
    value: boolean;
    onChange: (id: string, value: boolean) => void;
    trueText?: React.ReactNode;
    falseText?: React.ReactNode;
    disabled?: boolean;
    setByEnv: boolean;
    disabledText?: React.ReactNode;
    helpText: React.ReactNode;
}

const BooleanSetting = ({
    id,
    label,
    value,
    onChange,
    trueText = (
        <FormattedMessage
            id='admin.true'
            defaultMessage='True'
        />
    ),
    falseText = (
        <FormattedMessage
            id='admin.false'
            defaultMessage='False'
        />
    ),
    disabled = false,
    setByEnv,
    disabledText,
    helpText,
}: Props) => {
    const helptext = useMemo(() => {
        if (disabled && disabledText) {
            return (
                <div>
                    <span className='admin-console__disabled-text'>
                        {disabledText}
                    </span>
                    {helpText}
                </div>
            );
        }
        return helpText;
    }, [helpText, disabled, disabledText]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.value === 'true');
    }, [id, onChange]);

    return (
        <SettingSet
            helpText={helptext}
            inputId={id}
            label={label}
            setByEnv={setByEnv}
        >
            <Label isDisabled={disabled || setByEnv}>
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
            </Label>
            <Label isDisabled={disabled || setByEnv}>
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
            </Label>
        </SettingSet>
    );
};

export default React.memo(BooleanSetting);
