// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import AdminPanel from './admin_panel';

type Props = {
    children?: React.ReactNode;
    className?: string;
    id?: string;
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    onButtonClick?: React.EventHandler<React.MouseEvent>;
    disabled?: boolean;
    buttonText?: MessageDescriptor;

    // Renders the panel action in the danger colour, for panels whose button
    // removes something.
    destructive?: boolean;
};

const AdminPanelWithButton = ({
    className = '',
    subtitle,
    title,
    buttonText,
    children,
    destructive,
    disabled,
    id,
    onButtonClick,
}: Props) => {
    let button;
    if (onButtonClick && buttonText) {
        const buttonId = (buttonText.defaultMessage as string || '').split(' ').join('-').toLowerCase();
        button = (
            <Button
                emphasis='primary'
                destructive={destructive}
                className={classNames({disabled})}
                onClick={disabled ? undefined : onButtonClick}
                data-testid={buttonId}
            >
                <FormattedMessage
                    {...buttonText}
                />
            </Button>
        );
    }

    return (
        <AdminPanel
            className={classNames('AdminPanelWithButton', className)}
            id={id}
            title={title}
            subtitle={subtitle}
            button={button}
        >
            {children}
        </AdminPanel>
    );
};

export default AdminPanelWithButton;
