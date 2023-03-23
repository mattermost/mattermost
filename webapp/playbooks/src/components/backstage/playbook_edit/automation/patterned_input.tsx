// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';

import {SelectorWrapper} from 'src/components/backstage/playbook_edit/automation/styles';

interface Props {
    enabled: boolean;
    placeholderText: string;
    errorText: string;
    input: string;
    type: string;
    pattern: string;
    onChange: (updatedInput: string) => void;
    maxLength?: number;
}

export const PatternedInput = (props: Props) => (
    <SelectorWrapper>
        <TextBox
            disabled={!props.enabled}
            type={props.type}
            required={true}
            value={props.input}
            onChange={(e) => props.onChange(e.target.value)}
            pattern={props.pattern}
            placeholder={props.placeholderText}
            maxLength={props.maxLength}
        />
        <ErrorMessage>
            {props.errorText}
        </ErrorMessage>
    </SelectorWrapper>
);

const ErrorMessage = styled.div`
    color: var(--error-text);
    margin-left: auto;
    display: none;
`;

interface TextBoxProps {
    disabled: boolean;
}

const TextBox = styled.input<TextBoxProps>`
    ::placeholder {
        color: var(--center-channel-color);
        opacity: 0.64;
    }
    background: ${(props) => (props.disabled ? 'auto' : 'var(--center-channel-bg)')};
    height: 40px;
    width: 100%;
    color: var(--center-channel-color);
    border-radius: 4px;
    border: none;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    font-size: 14px;
    padding-left: 16px;
    padding-right: 16px;

    ${(props) => !props.disabled && props.value && css`
        :invalid:not(:focus) {
            box-shadow: inset 0 0 0 1px var(--error-text);

            & + ${ErrorMessage} {
                display: inline-block;
            }
        }
    `}
`;

