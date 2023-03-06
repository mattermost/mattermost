// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

interface ToggleProps {
    children?: React.ReactNode
    isChecked: boolean;
    disabled?: boolean;
    onChange: () => void;
}

export const Toggle = (props: ToggleProps) => {
    return (
        <Label
            disabled={props.disabled}
            tabIndex={0}
        >
            <InvisibleInput
                type='checkbox'
                onChange={props.onChange}
                checked={props.isChecked}
                disabled={props.disabled}
            />
            <RoundSwitch disabled={props.disabled}/>
            {props.children}
        </Label>
    );
};

interface DisabledProps {
    disabled?: boolean;
}

const RoundSwitch = styled.span<DisabledProps>`
    position: relative;
    display: inline-block;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    transition: .4s;

    // Outer rectangle
    width: 40px;
    height: 24px;
    border-radius: 14px;
    background: rgba(var(--center-channel-color-rgb), ${({disabled}) => (disabled ? '0.08' : '0.24')});

    // Inner circle
    ::before {
        position: absolute;
        width: 20px;
        height: 20px;
        left: 2px;
        top: calc(50% - 20px/2);

        border-radius: 50%;
        background: var(--center-channel-bg);
        box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);

        content: "";
        transition: .4s;
    }

    input:checked + && {
        background-color: ${({disabled}) => (disabled ? 'var(--button-bg-30)' : 'var(--button-bg)')}
    }

    input:checked + &&::before {
        transform: translateX(16px);
    }

`;

const InvisibleInput = styled.input`
    display: none;
`;

const Label = styled.label<DisabledProps>`
    display: flex;
    align-items: center;
    column-gap: 12px;
    font-weight: inherit;
    line-height: 16px;
    cursor: ${({disabled}) => (disabled ? 'default' : 'pointer')};
    margin-bottom: 0;
`;
