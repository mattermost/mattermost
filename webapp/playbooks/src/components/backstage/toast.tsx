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
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 4px 4px 4px 12px;
    margin: 4px;
    height: 48px;

    background: ${({toastStyle}) => (toastStyle === ToastStyle.Failure ? 'var(--dnd-indicator)' : 'var(--center-channel-color)')};
    color: ${({toastStyle}) => (toastStyle === ToastStyle.Failure ? 'var(--center-channel-color)' : 'var(--center-channel-bg)')};

    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.12);
    border-radius: 4px;

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
    font-family: Open Sans;
    font-style: normal;
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;

    display: flex;
    align-items: center;
    text-align: left;

    margin: 0px 8px;
    color: var(--center-channel-bg);
`;

const StyledIcon = styled.i`
    color: var(--center-channel-bg);
`;

const StyledClose = styled.i`
    cursor: pointer;
    color: var(--center-channel-bg-56);
`;

const StyledButton = styled.button`
    background: rgba(var(--center-channel-bg-rgb), 0.12);
    color: var(--center-channel-bg);
    border-radius: 4px;
    padding: 8px 16px;
    margin: 8px;
    border: none;
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
`;
