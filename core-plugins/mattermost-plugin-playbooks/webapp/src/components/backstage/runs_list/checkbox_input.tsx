// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

const Component = styled.label`
    width: fit-content;
    padding: 10px 16px;
    border-radius: 4px;
    margin-bottom: 0;
    cursor: pointer;
    transition: background-color 0.2s;
    user-select: none;
    white-space: nowrap;

    &:hover {
        background-color: rgba(var(--button-bg-rgb), 0.08);
    }

    input {
        display: none;
    }

    input + span::before {
        width: 16px;
        height: 16px;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
        border-radius: 2px;
        margin-right: 10px;
        background-color: var(--center-channel-bg);
        color: var(--center-channel-bg);
        content: '\f012c';
        font-family: compass-icons;
        font-size: 14px;
        transition: color 0.2s, background-color 0.2s;
    }

    input:checked + span::before {
        border: 1px solid transparent;
        background-color: var(--button-bg);
        color: var(--button-color);
    }
`;

interface Props {
    testId: string;
    text: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    className?: string
    disabled?: boolean;
}

const CheckboxInput = (props: Props) => {
    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        props.onChange(event.target.checked);
    };

    return (
        <Component
            data-testid={props.testId}
            className={props.className}
        >
            <input
                type='checkbox'
                onChange={onChange}
                checked={props.checked}
                disabled={props.disabled}
            />
            <span>
                {props.text}
            </span>
        </Component>
    );
};

export default CheckboxInput;
