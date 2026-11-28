// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

export enum ToastStyle {
    Success = 'success',
    Failure = 'failure',
    Informational = 'inform',
}

export interface ToastProps {
    content: string;
    toastStyle?: ToastStyle;
    iconName?: string;
    buttonName?: string;
    buttonCallback?: () => void;
    closeCallback?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export const Toast = (props: ToastProps) => {
    let iconName = props.iconName;
    if (!iconName) {
        switch (props.toastStyle) {
        case ToastStyle.Success:
            iconName = 'check';
            break;
        case ToastStyle.Failure:
            iconName = 'alert-outline';
            break;
        default:
            iconName = 'information-outline';
        }
    }
    return (
        <StyledToast
            toastStyle={props.toastStyle ?? ToastStyle.Success}
            onMouseEnter={props.onMouseEnter}
            onMouseLeave={props.onMouseLeave}
        >
            <StyledIcon className={`icon icon-${iconName}`}/>
            <StyledText>{props.content}</StyledText>
            {props.buttonName &&
                <StyledButton
                    onClick={props.buttonCallback}
                >
                    {props.buttonName}
                </StyledButton>
            }
            <StyledClose
                className={'icon icon-close'}
                onClick={props.closeCallback}
            />
        </StyledToast >
    );
};

const StyledToast = styled.div<{toastStyle: ToastStyle}>`
    display: flex;
    height: 48px;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 4px 4px 4px 12px;
    border-radius: 4px;
    margin: 4px;
    background: ${({toastStyle}) => (toastStyle === ToastStyle.Failure ? 'var(--dnd-indicator)' : 'var(--center-channel-color)')};
    box-shadow: 0 4px 6px rgba(0 0 0 / 0.12);
    color: ${({toastStyle}) => (toastStyle === ToastStyle.Failure ? 'var(--center-channel-color)' : 'var(--center-channel-bg)')};

    &.fade-enter {
        transform: translateY(80px);
    }

    &.fade-enter-active {
        transform: translateY(0);
        transition: 0.5s cubic-bezier(0.44, 0.13, 0.42, 1.43);
    }

    &.fade-exit {
        transform: translateY(0);
    }

    &.fade-exit-active {
        transform: translateY(280px);
        transition: transform 0.75s cubic-bezier(0.59, -0.23, 0.42, 1.43);
    }
`;

const StyledText = styled.div`
    display: flex;
    align-items: center;
    margin: 0 8px;
    color: var(--center-channel-bg);
    font-family: "Open Sans";
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;
    text-align: left;
`;

const StyledIcon = styled.i`
    color: var(--center-channel-bg);
`;

const StyledClose = styled.i`
    color: var(--center-channel-bg-56);
    cursor: pointer;
`;

const StyledButton = styled.button`
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    margin: 8px;
    background: rgba(var(--center-channel-bg-rgb), 0.12);
    color: var(--center-channel-bg);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;
