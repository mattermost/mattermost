// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {Radio} from '@mattermost/compass-ui/components/radio';

import * as Utils from 'utils/utils';

import SettingSet from './setting_set';

// Layout only — Compass Radio owns radio/label visuals. Offset matches
// Bootstrap control-label padding-top; width:auto overrides Radio's width:100%.
const BooleanRadioGroup = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 8px;
    gap: 24px;

    > label {
        width: auto;
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
};

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

    const isDisabled = disabled || setByEnv;

    return (
        <SettingSet
            helpText={helptext}
            inputId={id}
            label={label}
            setByEnv={setByEnv}
        >
            <BooleanRadioGroup>
                <Radio
                    data-testid={id + 'true'}
                    value='true'
                    id={Utils.createSafeId(id) + 'true'}
                    name={id}
                    checked={value}
                    onChange={handleChange}
                    disabled={isDisabled}
                >
                    {trueText}
                </Radio>
                <Radio
                    data-testid={id + 'false'}
                    value='false'
                    id={Utils.createSafeId(id) + 'false'}
                    name={id}
                    checked={!value}
                    onChange={handleChange}
                    disabled={isDisabled}
                >
                    {falseText}
                </Radio>
            </BooleanRadioGroup>
        </SettingSet>
    );
};

export default React.memo(BooleanSetting);
