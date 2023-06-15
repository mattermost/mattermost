// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';

import './external_login_button.scss';
import {isDesktopApp} from 'utils/user_agent';

import ExternalLink from 'components/external_link';

export type ExternalLoginButtonType = {
    id: string;
    url: string;
    icon: React.ReactNode;
    label: string;
    style?: React.CSSProperties;
    direction?: 'row' | 'column';
    onClick?: () => void;
};

const ExternalLoginButton = ({
    id,
    url,
    icon,
    label,
    style,
    direction = 'row',
    onClick,
}: ExternalLoginButtonType) => {
    const link = (children: React.ReactNode) => {
        const linkProps = {
            id,
            className: classNames('external-login-button', {'direction-column': direction === 'column'}, id),
            href: url,
            style,
            onClick,
        };

        if (isDesktopApp()) {
            return <ExternalLink {...linkProps}>{children}</ExternalLink>;
        }
        return <a {...linkProps}>{children}</a>;
    };

    return link(
        <>
            {icon}
            <span className='external-login-button-label'>
                {label}
            </span>
        </>,
    );
};

export default ExternalLoginButton;
