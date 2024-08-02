// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import AdminPanel from './admin_panel';

type Props = {
    children?: React.ReactNode;
    className: string;
    id?: string;
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    onButtonClick?: React.EventHandler<React.MouseEvent>;
    disabled?: boolean;
    buttonText?: MessageDescriptor;
}

const AdminPanelWithButton = ({
    className,
    subtitle,
    title,
    buttonText,
    children,
    disabled,
    id,
    onButtonClick,
}: Props) => {
    let button;
    if (onButtonClick && buttonText) {
        const buttonId = (buttonText.defaultMessage as string || '').split(' ').join('-').toLowerCase();
        button = (
            <a
                className={classNames('btn', 'btn-primary', {disabled})}
                onClick={disabled ? (e) => e.preventDefault() : onButtonClick}
                data-testid={buttonId}
            >
                <FormattedMessage
                    {...buttonText}
                />
            </a>
        );
    }

    return (
        <AdminPanel
            className={'AdminPanelWithButton ' + className}
            id={id}
            title={title}
            subtitle={subtitle}
            button={button}
        >
            {children}
        </AdminPanel>
    );
};

AdminPanelWithButton.defaultProps = {
    className: '',
};

export default AdminPanelWithButton;
