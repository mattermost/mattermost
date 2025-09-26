// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Toggle from 'components/toggle';

const SwitchRow = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    width: 100%;
`;

const LabelColumn = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
`;

const LabelText = styled.div`
    font-weight: 600;
    color: var(--center-channel-color);
    margin-bottom: 4px;
    word-break: break-word;
`;

const HelpText = styled.div`
    color: var(--center-channel-color-75, #999);
    font-size: 14px;
    line-height: 20px;
    margin-top: 0;
    word-break: break-word;
`;

const ToggleColumn = styled.div`
    flex: 0 0 auto;
    display: flex;
    align-items: center;
`;

const Separator = styled.hr`
    border: none;
    border-top: 1px solid var(--center-channel-color-12, #e0e0e0);
    margin-left: -32px;
    margin-right: -32px;
`;

type Props = {
    id: string;
    label: React.ReactNode;
    value: boolean;
    onChange: (id: string, value: boolean) => void;
    disabled?: boolean;
    setByEnv: boolean;
    disabledText?: React.ReactNode;
    helpText: React.ReactNode;
    onText?: React.ReactNode;
    offText?: React.ReactNode;
}

const SwitchSetting = ({
    id,
    label,
    value,
    onChange,
    disabled = false,
    setByEnv,
    disabledText,
    helpText,
    onText = 'On',
    offText = 'Off',
}: Props) => {
    const handleToggle = () => {
        if (!disabled && !setByEnv) {
            onChange(id, !value);
        }
    };

    const helptext = disabled && disabledText ? (
        <span className='admin-console__disabled-text'>{disabledText}{helpText}</span>
    ) : helpText;

    return (
        <>
            <fieldset
                data-testid={id}
                id={id}
                className='form-group'
            >
                <SwitchRow>
                    <legend className='control-label form-legend col-sm-10'>
                        <LabelColumn>
                            <LabelText>{label}</LabelText>
                            {helptext && <HelpText>{helptext}</HelpText>}
                        </LabelColumn>
                    </legend>
                    <ToggleColumn>
                        <span style={{marginRight: '8px', minWidth: '32px', textAlign: 'right'}}>
                            {value ? onText : offText}
                        </span>
                        <Toggle
                            ariaLabel={typeof label === 'string' ? label : undefined}
                            size='btn-md'
                            disabled={disabled || setByEnv}
                            onToggle={handleToggle}
                            toggled={value}
                            id={id}
                            tabIndex={-1}
                            toggleClassName='btn-toggle-primary'
                        />
                    </ToggleColumn>
                </SwitchRow>
            </fieldset>
            {value && <Separator/>}
        </>
    );
};

export default React.memo(SwitchSetting);
