// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './external_login_button.scss';

export type ExternalLoginButtonType = {
    id: string;
    url: string;
    icon: React.ReactNode;
    label: string;
    style?: React.CSSProperties;
    direction?: 'row' | 'column';
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

const ExternalLoginButton = ({
    id,
    url,
    icon,
    label,
    style,
    direction = 'row',
    onClick,
}: ExternalLoginButtonType) => (
    <a
        id={id}
        className={classNames('external-login-button', {'direction-column': direction === 'column'}, id)}
        href={url}
        style={style}
        onClick={onClick}
    >
        {icon}
        <span className='external-login-button-label'>
            {label}
        </span>
    </a>
);

export default ExternalLoginButton;
