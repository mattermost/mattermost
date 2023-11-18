// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import AdminPanel from './admin_panel';

type Props = {
    children?: React.ReactNode;
    className?: string;
    id?: string;
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    subtitleValues?: any;
    url: string;
    disabled?: boolean;
    linkText: MessageDescriptor;
}

const AdminPanelWithLink = ({
    className = '',
    linkText,
    subtitle,
    title,
    url,
    children,
    disabled,
    id,
    subtitleValues,
}: Props) => {
    const button = (
        <Link
            data-testid={`${id}-link`}
            className={classNames(['btn', 'btn-primary', {disabled}])}
            to={url}
            onClick={disabled ? (e) => e.preventDefault() : () => null}
        >
            <FormattedMessage
                {...linkText}
            />
        </Link>
    );

    return (
        <AdminPanel
            className={'AdminPanelWithLink ' + className}
            id={id}
            data-testid={id}
            title={title}
            subtitle={subtitle}
            subtitleValues={subtitleValues}
            button={button}
        >
            {children}
        </AdminPanel>
    );
};

export default AdminPanelWithLink;
