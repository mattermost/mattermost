// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import styled, {css} from 'styled-components';

import {AlertOutlineIcon, CheckIcon, InformationOutlineIcon} from '@mattermost/compass-icons/components';

type NotificationVariant = 'general' | 'info' | 'success'| 'warning' | 'danger';

type NotificationProps = {
    id?: string;
    dismissable?: boolean;
    title?: JSX.Element | string;
    text: JSX.Element | string;
    variant: NotificationVariant;
}

const variantColorMap: Record<NotificationVariant, string> = {
    general: 'var(--semantic-color-general)',
    info: 'var(--semantic-color-info)',
    success: 'var(--semantic-color-success)',
    warning: 'var(--semantic-color-warning)',
    danger: 'var(--semantic-color-danger)',
};

type NotificationWrapperProps = {
    color: string;
}

const NotificationWrapper = styled.div(({color}: NotificationWrapperProps) => {
    return css`
        display: grid;
        grid-template-columns: minmax(0px, max-content) 1fr  minmax(0px, max-content);
        grid-template-rows: auto;
        grid-template-areas:
          "icon title close"
          ". text ."
          ". actions .";
        column-gap: 4px;

        padding: 16px;
        background-color: rgba(${color}, 0.08);
        border-width: 1px;
        border-style: solid;
        border-color: rgba(${color}, 0.16);
        border-radius: 4px;
    `;
});

const NotificationIcon = styled.div`
    grid-area: icon;
    width: 24px;
    place-items: center;
    place-content: center;
`;

const NotificationTitle = styled.h2`
    grid-area: title;
    color: rgb(var(--center-channel-color-rgb));
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
`;

const NotificationText = styled.p(({noTitle}: {noTitle: boolean}) => {
    const area = noTitle ? 'title' : 'text';
    return css`
        grid-area: ${area};
        color: rgb(var(--center-channel-color-rgb));
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        margin: 0;
    `;
});

const NotificationBox = ({variant, title, text, id = ''}: NotificationProps) => {
    const color = variantColorMap[variant];

    const iconProps = {
        size: 20,
        color: `rgb(${color})`,
    };

    let icon = null;
    switch (variant) {
    case 'info':
        icon = <InformationOutlineIcon {...iconProps}/>;
        break;
    case 'success':
        icon = <CheckIcon {...iconProps}/>;
        break;
    case 'warning':
    case 'danger':
        icon = <AlertOutlineIcon {...iconProps}/>;
        break;
    case 'general':
    default:
        break;
    }

    return (
        <NotificationWrapper
            color={color}
            data-testid={`notification${id ? `_${id}` : ''}`}
        >
            <NotificationIcon>
                {icon}
            </NotificationIcon>
            {title && <NotificationTitle>{title}</NotificationTitle>}
            {text && (
                <NotificationText
                    noTitle={!title}
                    data-testid={'notification-text'}
                >
                    {text}
                </NotificationText>
            )}
        </NotificationWrapper>
    );
};

export default memo(NotificationBox);
